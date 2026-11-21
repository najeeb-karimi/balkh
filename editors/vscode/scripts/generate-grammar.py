"""Generate the checked-in TextMate grammar and language configuration."""

import argparse
import json
import keyword
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from balkh.keywords import KEYWORDS


CONTINUE = r"[\p{L}\p{M}\p{N}\p{Pc}\x{200C}\x{200D}]"
IDENTIFIER = r"[\p{L}\p{Nl}_][\p{L}\p{M}\p{N}\p{Pc}\x{200C}\x{200D}]*"
DIGIT = "[0-9۰-۹٠-٩]"
SEQUENCE = DIGIT + "(?:_?" + DIGIT + ")*"


def spellings(english):
    return set(english) | {native for native, python in KEYWORDS.items() if python in english}


def alternatives(words):
    return "(?:" + "|".join(re.escape(word) for word in sorted(words, key=lambda w: (-len(w), w))) + ")"


def word_match(words):
    # Explicit Unicode boundaries prevent matching a keyword inside a native identifier.
    return rf"(?<!{CONTINUE}){alternatives(words)}(?!{CONTINUE})"


def named_rule(words, scope):
    return {"name": scope + ".balkh", "match": word_match(words)}


def grammar():
    builtins = {value for value in KEYWORDS.values() if not keyword.iskeyword(value)}
    constants = {"True", "False", "None"}
    decimal = rf"(?:{SEQUENCE}\.(?:{SEQUENCE})?|\.{SEQUENCE}|{SEQUENCE})(?:[eE][+-]?{SEQUENCE})?[jJ]?"
    radix = r"[0۰٠](?:[xX](?:_?[0-9۰-۹٠-٩a-fA-F])+|[bB](?:_?[01۰۱٠١])+|[oO](?:_?[0-7۰-۷٠-٧])+)"
    expression = [{"include": "#" + name} for name in (
        "comments", "strings", "numbers", "definitions", "constants", "keywords",
        "builtins", "brackets", "operators", "punctuation", "identifiers",
    )]
    repository = {
        "expression": {"patterns": expression},
        "comments": {
            "name": "comment.line.number-sign.balkh", "match": "(#).*$",
            "captures": {"1": {"name": "punctuation.definition.comment.balkh"}},
        },
        "numbers": {
            "name": "constant.numeric.balkh",
            "match": rf"(?<!{CONTINUE})(?:{radix}|{decimal})(?!{CONTINUE})",
        },
        "definitions": {"patterns": [
            {
                "match": rf"({word_match(spellings({python}))})(\s+)({IDENTIFIER})",
                "captures": {
                    "1": {"name": "storage.type." + kind + ".balkh"},
                    "3": {"name": "entity.name." + kind + ".balkh"},
                },
            }
            for python, kind in (("def", "function"), ("class", "type"))
        ]},
        "constants": named_rule(spellings(constants), "constant.language"),
        "keywords": named_rule(spellings(set(keyword.kwlist) - constants), "keyword.control"),
        "builtins": named_rule(spellings(builtins), "support.function.builtin"),
        "brackets": {"patterns": [
            {
                "begin": re.escape(left), "end": re.escape(right),
                "beginCaptures": {"0": {"name": "punctuation.section.brackets.begin.balkh"}},
                "endCaptures": {"0": {"name": "punctuation.section.brackets.end.balkh"}},
                "patterns": [{"include": "#expression"}],
            }
            for left, right in (("(", ")"), ("[", "]"), ("{", "}"))
        ]},
        "operators": {"name": "keyword.operator.balkh", "match": r"[-+*/%<>=!&|^~@]+|:="},
        "punctuation": {"name": "punctuation.separator.balkh", "match": r"[.,:;]"},
        "identifiers": {"name": "variable.other.readwrite.balkh", "match": rf"(?<!{CONTINUE}){IDENTIFIER}"},
        "continuation": {
            "name": "constant.character.escape.balkh", "begin": r"\\$", "end": "^",
        },
        "interpolation": {
            "name": "meta.interpolation.balkh",
            "contentName": "meta.embedded.expression.balkh",
            "begin": r"\{", "end": r"\}",
            "beginCaptures": {"0": {"name": "punctuation.section.interpolation.begin.balkh"}},
            "endCaptures": {"0": {"name": "punctuation.section.interpolation.end.balkh"}},
            "patterns": [
                {"name": "storage.modifier.conversion.balkh", "match": r"![sra](?=[:}])"},
                {"include": "#format-spec"},
                {"include": "#expression"},
            ],
        },
        "format-spec": {
            "name": "meta.format-spec.balkh", "begin": ":", "end": r"(?=\})",
            "beginCaptures": {"0": {"name": "punctuation.separator.format-spec.balkh"}},
            "patterns": [{"include": "#interpolation"}],
        },
    }
    strings = []
    prefixes = (
        ("(?i:fr|rf)", True, True), ("(?i:f)", True, False),
        ("(?i:br|rb|r)", False, True), ("(?i:[ub]?)", False, False),
    )
    for prefix, formatted, raw in prefixes:
        for quote, kind in (("'''", "multi.single"), ('"""', "multi.double"), ("'", "single"), ('"', "double")):
            patterns = []
            if len(quote) == 1:
                patterns.append({"include": "#continuation"})
            escape = r"\\[\\'\"]" if raw else (
                r"\\(?:N\{[^}]*\}|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|"
                + (r"[^{}]" if formatted else ".") + ")"
            )
            patterns.append({"name": "constant.character.escape.balkh", "match": escape})
            if formatted:
                patterns.extend([
                    {"name": "constant.character.escape.brace.balkh", "match": r"\{\{|\}\}"},
                    {"include": "#interpolation"},
                ])
            strings.append({
                "name": "string.quoted." + kind + ".balkh",
                "begin": rf"(?<!{CONTINUE})({prefix})({re.escape(quote)})",
                "end": "(" + re.escape(quote) + ")" + ("|$" if len(quote) == 1 else ""),
                "beginCaptures": {
                    "1": {"name": "storage.type.string.balkh"},
                    "2": {"name": "punctuation.definition.string.begin.balkh"},
                },
                "endCaptures": {"1": {"name": "punctuation.definition.string.end.balkh"}},
                "patterns": patterns,
            })
    repository["strings"] = {"patterns": strings}
    return {
        "name": "Balkh", "scopeName": "source.balkh", "fileTypes": ["blk"],
        "patterns": [{"include": "#expression"}], "repository": repository,
    }


def configuration():
    blocks = spellings({"def", "class", "if", "elif", "else", "for", "while", "try", "except", "finally", "with"})
    branches = spellings({"elif", "else", "except", "finally"})
    async_prefix = alternatives(spellings({"async"}))
    pairs = [["(", ")"], ["[", "]"], ["{", "}"], ["'", "'"], ['"', '"']]
    return {
        "comments": {"lineComment": "#"}, "brackets": pairs[:3],
        "autoClosingPairs": [
            {"open": left, "close": right, "notIn": ["string", "comment"]}
            for left, right in pairs
        ],
        "surroundingPairs": pairs, "folding": {"offSide": True},
        "wordPattern": r"[^\s`~!@#$%^&*()=+\[\]{}\\|;:'\",.<>/?-]+",
        "indentationRules": {
            "increaseIndentPattern": rf"^\s*(?:{async_prefix}\s+)?{alternatives(blocks)}(?=\s|:|\(|$).*:\s*(?:#.*)?$",
            "decreaseIndentPattern": rf"^\s*(?:{alternatives(branches)}(?=\s|:|$).*:|[\]\)}}])",
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if generated files are stale")
    args = parser.parse_args()
    extension = Path(__file__).resolve().parents[1]
    for path, value in (
        (extension / "syntaxes" / "balkh.tmLanguage.json", grammar()),
        (extension / "language-configuration.json", configuration()),
    ):
        content = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                parser.exit(1, "Generated grammar/configuration is stale; run npm run generate.\n")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("w", encoding="utf-8", newline="\n") as output:
                output.write(content)


if __name__ == "__main__":
    main()
