// The innermost recognized TextMate scope wins; embedded expressions stop string inheritance.
function tokenClass(scopes) {
  for (let index = scopes.length - 1; index >= 0; index--) {
    const scope = scopes[index];
    if (scope.startsWith('meta.embedded.expression')) return '';
    if (scope.startsWith('comment') || scope.startsWith('punctuation.definition.comment')) return 'comment';
    if (scope.startsWith('punctuation.definition.string')) return 'string';
    if (scope.startsWith('constant.character.escape')) return 'string.escape';
    if (scope.startsWith('string')) return 'string';
    if (scope.startsWith('constant.numeric')) return 'number';
    if (scope.startsWith('constant.language')) return 'constant';
    if (scope.startsWith('keyword') || scope.startsWith('storage.type.function') || scope.startsWith('storage.type.type') || scope.startsWith('storage.modifier')) return 'keyword';
    if (scope.startsWith('support.function')) return 'predefined';
    if (scope.startsWith('entity.name.function')) return 'function';
    if (scope.startsWith('entity.name.type')) return 'type';
    if (scope.startsWith('punctuation')) return 'delimiter';
  }
  return '';
}
module.exports = { tokenClass };
