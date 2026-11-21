import json
from pathlib import Path
import subprocess
import sys


EXTENSION = Path(__file__).resolve().parents[1] / "editors" / "vscode"


def test_vscode_generated_files_match_current_language_keywords():
    result = subprocess.run(
        [sys.executable, str(EXTENSION / "scripts" / "generate-grammar.py"), "--check"],
        capture_output=True, encoding="utf-8", timeout=10,
    )
    assert result.returncode == 0, result.stderr


def test_vscode_manifest_references_shipped_language_files():
    manifest = json.loads((EXTENSION / "package.json").read_text(encoding="utf-8"))
    language = manifest["contributes"]["languages"][0]
    grammar = manifest["contributes"]["grammars"][0]
    assert language["extensions"] == [".blk"]
    assert language["id"] == grammar["language"] == "balkh"
    assert grammar["scopeName"] == "source.balkh"
    for filename in (language["configuration"], grammar["path"]):
        assert (EXTENSION / filename).is_file()
    assert (EXTENSION / manifest["main"]).is_file()
    editor = manifest["contributes"]["customEditors"][0]
    assert editor["viewType"] == "balkh.rtlEditor"
    assert editor["priority"] == "option"
    assert editor["selector"] == [{"filenamePattern": "*.blk"}]
