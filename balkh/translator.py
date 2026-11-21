"""Translate Python and Balkh names without rewriting surrounding source text."""

from io import StringIO
import tokenize

from balkh.keywords import KEYWORDS, REVERSE_KEYWORDS


def _rewrite_tokens(source, replacement):
    line_offsets = [0]
    for line in source.split("\n"):
        line_offsets.append(line_offsets[-1] + len(line) + 1)

    parts = []
    cursor = 0
    # The caller has already decoded the source; ignore encoding cookies here.
    for token in tokenize.generate_tokens(StringIO(source).readline):
        text = replacement(token)
        if text != token.string:
            start = line_offsets[token.start[0] - 1] + token.start[1]
            end = line_offsets[token.end[0] - 1] + token.end[1]
            parts.extend((source[cursor:start], text))
            cursor = end
    parts.append(source[cursor:])
    return "".join(parts)


def normalize_digits(code: str) -> str:
    """Normalize code digits while preserving string literals and comments."""
    table = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "0123456789" * 2)
    preserved_types = {tokenize.STRING, tokenize.COMMENT}
    for name in ("FSTRING_MIDDLE", "TSTRING_MIDDLE"):
        if hasattr(tokenize, name):
            preserved_types.add(getattr(tokenize, name))
    return _rewrite_tokens(
        code,
        lambda token: token.string
        if token.type in preserved_types else token.string.translate(table),
    )


def _translate_names(source, mapping):
    return _rewrite_tokens(
        source,
        lambda token: mapping.get(token.string, token.string)
        if token.type == tokenize.NAME else token.string,
    )


def transpile(source_code: str) -> str:
    """Translate Balkh keywords and native numeric literals to Python."""
    return _translate_names(normalize_digits(source_code), KEYWORDS)


def reverse_transpile(source_code: str, language: str = "dari") -> str:
    """Translate Python names to preferred Dari or Pashto Balkh aliases.

    Numerals, strings, comments, and formatting retain their original text.
    Python keywords without a Balkh alias remain valid English keywords.
    """
    if language not in REVERSE_KEYWORDS:
        raise ValueError("language must be 'dari' or 'pashto'")
    return _translate_names(source_code, REVERSE_KEYWORDS[language])
