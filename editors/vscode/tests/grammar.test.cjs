const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const textmate = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');
const { tokenClass } = require('../src/tokens.cjs');

const extension = path.resolve(__dirname, '..');
const root = path.resolve(extension, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'package.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(extension, 'language-configuration.json'), 'utf8'));
const aliases = JSON.parse(execFileSync(process.env.PYTHON || 'python', [
  '-c', 'import json; from balkh.keywords import KEYWORDS; print(json.dumps(KEYWORDS))',
], { cwd: root, encoding: 'utf8' }));
let grammar;

before(async () => {
  const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  const grammarPath = path.join(extension, manifest.contributes.grammars[0].path);
  const raw = textmate.parseRawGrammar(fs.readFileSync(grammarPath, 'utf8'), grammarPath);
  const registry = new textmate.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
      createOnigString: (value) => new oniguruma.OnigString(value),
    }),
    loadGrammar: async (scope) => scope === 'source.balkh' ? raw : null,
  });
  grammar = await registry.loadGrammar('source.balkh');
  assert.ok(grammar);
});

function tokenize(source) {
  let stack = textmate.INITIAL;
  return source.split(/\r?\n/).map((line) => {
    const result = grammar.tokenizeLine(line, stack, 1000);
    assert.equal(result.stoppedEarly, false, 'tokenizer exceeded its time limit');
    stack = result.ruleStack;
    return result.tokens.map((token) => ({ ...token, text: line.slice(token.startIndex, token.endIndex) }));
  });
}

function scopesAt(source, text, occurrence = 0) {
  let offset = -1;
  for (let index = 0; index <= occurrence; index++) {
    offset = source.indexOf(text, offset + 1);
    assert.notEqual(offset, -1, `missing test text: ${text}`);
  }
  const prefix = source.slice(0, offset);
  const row = prefix.split('\n').length - 1;
  const column = offset - prefix.lastIndexOf('\n') - 1;
  const token = tokenize(source)[row].find((item) => item.startIndex <= column && item.endIndex > column);
  assert.ok(token, `no token at ${text}`);
  return token.scopes;
}

function hasScope(source, text, prefix, occurrence = 0) {
  return scopesAt(source, text, occurrence).some((scope) => scope.startsWith(prefix));
}

test('manifest associates .blk with the shipped grammar and configuration', () => {
  assert.deepEqual(manifest.contributes.languages[0].extensions, ['.blk']);
  assert.equal(manifest.contributes.languages[0].id, 'balkh');
  assert.equal(manifest.contributes.grammars[0].scopeName, 'source.balkh');
  assert.equal(manifest.contributes.grammars[0].language, 'balkh');
  assert.equal(manifest.main, './extension.cjs');
  assert.equal(manifest.contributes.customEditors[0].priority, 'option');
  assert.equal(manifest.browser, undefined);
  assert.equal(manifest.dependencies, undefined);
  assert.ok(fs.existsSync(path.join(extension, manifest.contributes.languages[0].configuration)));
});

test('RTL token colors cover definitions, literals, comments, and embedded expressions', () => {
  const cases = [
    ['تابع سلام():', 'تابع', 'keyword'],
    ['تابع سلام():', 'سلام', 'function'],
    ['class Example:', 'Example', 'type'],
    ['چاپ(۱۲۳)', 'چاپ', 'predefined'],
    ['چاپ(۱۲۳)', '۱۲۳', 'number'],
    ['# تابع', '#', 'comment'],
    ['چاپ("سلام")', '"', 'string'],
    ['f"سلام {نام}"', 'سلام', 'string'],
    ['f"سلام {نام}"', 'نام', ''],
  ];
  for (const [source, text, expected] of cases) assert.equal(tokenClass(scopesAt(source, text)), expected, source);
});

test('every current Dari and Pashto keyword or builtin alias is highlighted', () => {
  const builtins = new Set(['print', 'input', 'range', 'len', 'int', 'float', 'str', 'list', 'dict', 'type', 'open']);
  const constants = new Set(['True', 'False', 'None']);
  for (const [native, python] of Object.entries(aliases)) {
    const expected = builtins.has(python) ? 'support.function.builtin'
      : constants.has(python) ? 'constant.language' : 'keyword.control';
    assert.ok(hasScope(native, native, expected), `${native} should have ${expected}`);
  }
});

test('English keywords and builtins work in mixed programs', () => {
  const source = 'if درست and not غلط: چاپ(len([1, ۲])) # mixed';
  for (const word of ['if', 'and', 'not']) assert.ok(hasScope(source, word, 'keyword.control'));
  for (const word of ['درست', 'غلط']) assert.ok(hasScope(source, word, 'constant.language'));
  for (const word of ['چاپ', 'len']) assert.ok(hasScope(source, word, 'support.function.builtin'));
});

test('Unicode and ASCII identifier boundaries prevent partial keyword matches', () => {
  for (const name of ['چاپگر', 'نام_چاپ', 'چاپ_نام', 'چاپ۱', 'چاپَ', 'چاپ‌نام', 'درستکاری', 'فنکشنی', 'printable', 'integer']) {
    const scopes = scopesAt(name, name);
    assert.ok(scopes.includes('variable.other.readwrite.balkh'), name);
    assert.ok(!scopes.some((scope) => /^(keyword|support|constant)/.test(scope)), name);
  }
});

test('ASCII, Persian/Pashto, and Arabic-Indic numeric literals', () => {
  for (const literal of [
    '123', '۱۲۳', '١٢٣', '۱۲.۳۴', '.۵', '۱_۰۰۰', '2e3', '۲e-۳',
    '0xFF', '۰x_FF', '٠b١٠', '۰o۷', '۲j', '۱۲۳.۰e+۲',
  ]) {
    const tokens = tokenize(literal)[0];
    assert.equal(tokens[0].text, literal);
    assert.ok(tokens[0].scopes.includes('constant.numeric.balkh'), literal);
  }
  assert.ok(!hasScope('نام۱۲۳', '۱۲۳', 'constant.numeric'));
});

test('comments protect keywords, numbers, and quote characters', () => {
  const source = '# چاپ if ۱۲۳ "not a string"';
  for (const text of ['چاپ', 'if', '۱۲۳', 'not a string']) {
    assert.ok(hasScope(source, text, 'comment.line'));
    assert.ok(!scopesAt(source, text).some((scope) => /^(keyword|constant|support|String)/.test(scope)));
  }
});

test('single, double, raw, bytes, and Unicode strings protect their text', () => {
  for (const source of ['"اگر چاپ ۱۲۳ #"', "'که چاپول ۱۲۳'", 'r"اگر چاپ \\n"', 'b"print 123"', 'u"اگر ۱۲۳"']) {
    const text = source.includes('اگر') ? 'اگر' : source.includes('که') ? 'که' : 'print';
    assert.ok(hasScope(source, text, 'string.quoted'), source);
    assert.ok(!hasScope(source, text, 'keyword.control'), source);
    assert.ok(!hasScope(source, text, 'support.function.builtin'), source);
  }
});

test('escaped quotes do not terminate a string', () => {
  const source = String.raw`"اگر \"چاپ\" ۱۲۳"`;
  assert.ok(hasScope(source, 'چاپ', 'string.quoted'));
  assert.ok(hasScope(source, '۱۲۳', 'string.quoted'));
  assert.ok(!hasScope(source, '۱۲۳', 'constant.numeric'));
});

test('triple-quoted strings retain state across lines and close correctly', () => {
  for (const quote of ['"""', "'''"]) {
    const source = `${quote}شروع\nاگر ۱۲۳\nپایان${quote}\nچاپ(۱)`;
    assert.ok(hasScope(source, 'اگر', 'string.quoted'));
    assert.ok(!hasScope(source, 'اگر', 'keyword.control'));
    assert.ok(hasScope(source, 'چاپ', 'support.function.builtin'));
  }
});

test('unterminated short strings reset at the next line', () => {
  const source = '"اگر\nچاپ(۱)';
  assert.ok(hasScope(source, 'اگر', 'string.quoted'));
  assert.ok(hasScope(source, 'چاپ', 'support.function.builtin'));
});

test('odd trailing backslashes continue a string, even backslashes do not', () => {
  for (const count of [1, 3]) {
    const source = ['"شروع' + '\\'.repeat(count), 'اگر ۱۲۳"', 'چاپ(۱)'].join('\n');
    assert.ok(hasScope(source, 'اگر', 'string.quoted'));
    assert.ok(!hasScope(source, 'اگر', 'keyword.control'));
    assert.ok(hasScope(source, 'چاپ', 'support.function.builtin'));
  }
  const source = ['"شروع' + '\\'.repeat(2), 'چاپ(۱)'].join('\n');
  assert.ok(hasScope(source, 'چاپ', 'support.function.builtin'));
});

test('f-string literals and escaped braces stay strings while expressions highlight', () => {
  for (const prefix of ['f', 'F', 'rf', 'Fr']) {
    const source = `${prefix}"سلام {{چاپ}} {طول([۱, ۲])}"`;
    assert.ok(hasScope(source, 'چاپ', 'string.quoted'));
    assert.ok(!hasScope(source, 'چاپ', 'support.function.builtin'));
    assert.ok(hasScope(source, 'طول', 'support.function.builtin'));
    assert.ok(hasScope(source, '۱', 'constant.numeric'));
    assert.ok(hasScope(source, 'طول', 'meta.embedded.expression'));
  }
});

test('f-string dictionaries, quoted braces, and format expressions nest correctly', () => {
  const source = `f"{ {'x': ۱, 'y': '}'}['x']!r:0{عرض}d}"\nچاپ(۲)`;
  assert.ok(hasScope(source, '۱', 'constant.numeric'));
  assert.ok(!hasScope(source, "'x':", 'meta.format-spec'));
  assert.ok(hasScope(source, 'عرض', 'variable.other.readwrite'));
  assert.ok(hasScope(source, 'عرض', 'meta.format-spec'));
  assert.ok(!hasScope(source, '0', 'constant.numeric'));
  assert.ok(hasScope(source, 'چاپ', 'support.function.builtin'));
});

test('function and class definitions highlight names in either language', () => {
  for (const keyword of ['def', 'تابع', 'فنکشن']) {
    const source = `${keyword} خوش_آمدید(نام):`;
    assert.ok(hasScope(source, keyword, 'storage.type.function'));
    assert.ok(hasScope(source, 'خوش_آمدید', 'entity.name.function'));
  }
  for (const keyword of ['class', 'صنف']) {
    const source = `${keyword} نمونه:`;
    assert.ok(hasScope(source, 'نمونه', 'entity.name.type'));
  }
});

test('language configuration supports native blocks, comments, and whole words', () => {
  assert.equal(config.comments.lineComment, '#');
  const increase = new RegExp(config.indentationRules.increaseIndentPattern);
  const decrease = new RegExp(config.indentationRules.decreaseIndentPattern);
  for (const line of ['اگر درست:', 'که سم: # test', 'فنکشن سلام():', 'برای نام در کاربران:', 'غیرهمزمان تابع سلام():', 'async def greet():']) {
    assert.ok(increase.test(line), line);
  }
  for (const line of ['چاپ("اگر:")', '# که سم:', 'اگرنام = ۱', 'print("hello")']) {
    assert.ok(!increase.test(line), line);
  }
  for (const line of ['وگرنه:', 'که_نه:', 'که_نه_نو x:', 'finally:', 'پرته ValueError:', ')']) {
    assert.ok(decrease.test(line), line);
  }
  for (const word of ['خوش_آمدید', 'مربع_ریښه', 'چاپول']) {
    assert.equal(word.match(new RegExp(config.wordPattern, 'g'))[0], word);
  }
});

test('all repository examples tokenize completely', () => {
  for (const file of fs.readdirSync(path.join(root, 'examples')).filter((name) => name.endsWith('.blk'))) {
    const source = fs.readFileSync(path.join(root, 'examples', file), 'utf8');
    assert.ok(tokenize(source).length > 0, file);
  }
});
