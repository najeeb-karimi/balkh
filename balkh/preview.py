"""Replace recognized Balkh library calls in already-transpiled Python."""

import ast
from collections import Counter
from io import StringIO
import tokenize


_MODULES = {
    "ریاضی": "math", "ریاضي": "math",
    "تصادفی": "random", "تصادفي": "random",
    "زمان": "datetime", "وخت": "datetime",
}


def _aliases(groups):
    return {name: target for target, names in groups.items() for name in names.split()}


_EXPORTS = {
    "math": _aliases({
        "sqrt": "جذر مربع_ریښه", "pow": "توان", "fabs": "قدر_مطلق مطلق_ارزښت",
        "ceil": "سقف پورته_ګردول", "floor": "کف ښکته_ګردول",
        "factorial": "فاکتوریل فاکټوریل", "sin": "سینوس", "cos": "کسینوس",
        "tan": "تانژانت", "log": "لگاریتم", "log10": "لگاریتم_ده", "exp": "نمایی",
        "radians": "رادیان", "degrees": "درجه", "pi": "پی", "e": "ای اي",
        "tau": "تاو", "inf": "بینهایت بې_پایه",
    }),
    "random": _aliases({
        "randint": "عدد_صحیح بشپړ_شمېر", "random": "اعشاری_تصادفی تصادفي_شمېره",
        "uniform": "یکنواخت یوشان", "choice": "انتخاب ټاکنه", "sample": "نمونه",
        "shuffle": "درهم_کردن ګډول", "seed": "بذر تخم",
    }),
    "datetime": _aliases({
        "date": "تاریخ نېټه", "datetime": "تاریخ_و_زمان نېټه_او_وخت", "time": "ساعت ګړۍ",
        "timezone": "منطقه_زمانی وخت_سیمه", "timezone.utc": "زمان_جهانی نړیوال_وخت",
        "datetime.now": "اکنون اوس", "date.today": "امروز نن", "timedelta": "مدت موده",
        "format": "قالب بڼه", "parse": "تجزیه لوستل",
    }),
}
_DURATION_UNITS = _aliases({
    "days": "روز ورځې", "hours": "ساعت ساعتونه", "minutes": "دقیقه دقیقې",
    "seconds": "ثانیه ثانیې", "weeks": "هفته اونۍ",
})
_WRAPPED = {"timedelta", "format", "parse"}
_PACKAGE = "balkh.stdlib"


def _bound_names(node):
    if isinstance(node, ast.Name) and not isinstance(node.ctx, ast.Load):
        return [node.id]
    if isinstance(node, ast.arg):
        return [node.arg]
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.ExceptHandler)):
        return [node.name] if node.name else []
    if type(node).__name__ in {"MatchAs", "MatchStar", "TypeVar", "TypeVarTuple", "ParamSpec"}:
        return [node.name] if node.name else []
    if type(node).__name__ == "MatchMapping":
        return [node.rest] if node.rest else []
    if isinstance(node, (ast.Import, ast.ImportFrom)):
        return [alias.asname or alias.name.split(".")[0] for alias in node.names]
    return []


def _available_name(base, reserved):
    name = base
    counter = 2
    while name in reserved:
        name = f"{base}_{counter}"
        counter += 1
    reserved.add(name)
    return name


def _simple_wrapper_call(call, target, export):
    """Check that the wrapper's exact argument meaning can be expressed inline."""
    if not isinstance(call, ast.Call) or any(isinstance(arg, ast.Starred) for arg in call.args):
        return False
    if target == "timedelta":
        units = ("روز ساعت دقیقه ثانیه هفته" if export == "مدت" else
                 "ورځې ساعتونه دقیقې ثانیې اونۍ").split()
        names = [item.arg for item in call.keywords]
        return len(call.args) <= 5 and len(set(names)) == len(names) and all(
            name in units[len(call.args):] for name in names
        )
    return not call.keywords and (len(call.args) == 1 or (
        len(call.args) == 2 and isinstance(call.args[1], ast.Constant)
        and (call.args[1].value is None or isinstance(call.args[1].value, str))
    ))


class _Source:
    """Apply edits at AST byte offsets while preserving the text between them."""

    def __init__(self, source):
        self.data = source.encode("utf-8")
        self.lines = [0]
        stream = StringIO(source, newline="")
        first_line = stream.readline()
        if first_line.endswith("\r\n"):
            self.newline = "\r\n"
        elif first_line.endswith("\r"):
            self.newline = "\r"
        else:
            self.newline = "\n"
        stream.seek(0)
        for line in stream:
            self.lines.append(self.lines[-1] + len(line.encode("utf-8")))
        self.edits = []

    def span(self, node):
        return (self.lines[node.lineno - 1] + node.col_offset,
                self.lines[node.end_lineno - 1] + node.end_col_offset)

    def text(self, node):
        start, end = self.span(node)
        return self.data[start:end].decode("utf-8")

    def import_spellings(self, node):
        if hasattr(node.names[0], "lineno"):
            return [self.text(alias) for alias in node.names]
        # Older Python ASTs give locations for the statement but not its aliases.
        text = self.text(node)
        offsets = [0]
        for line in StringIO(text, newline=""):
            offsets.append(offsets[-1] + len(line))
        tokens = iter(tokenize.generate_tokens(StringIO(text).readline))
        for token in tokens:
            if token.string == "import":
                break
        pieces = []
        start = end = None
        for token in tokens:
            if token.string in {",", ")"} and start is not None:
                pieces.append(text[start:end])
                start = end = None
            if token.type in {tokenize.NAME, tokenize.ERRORTOKEN} or token.string in {".", "*"}:
                if start is None:
                    start = offsets[token.start[0] - 1] + token.start[1]
                end = offsets[token.end[0] - 1] + token.end[1]
        if start is not None:
            pieces.append(text[start:end])
        return pieces

    def replace(self, node, text):
        start, end = self.span(node)
        self.edits.append((start, end, text.encode("utf-8")))

    def render(self, start, end, edits):
        pieces = []
        for left, right, text in sorted(edits):
            pieces.extend((self.data[start:left], text))
            start = right
        pieces.append(self.data[start:end])
        return b"".join(pieces).decode("utf-8")


class _StandardLibrary(ast.NodeVisitor):
    def __init__(self, tree, source):
        self.source = source
        nodes = list(ast.walk(tree))
        parents = {child: node for node in nodes for child in ast.iter_child_nodes(node)}
        bindings = Counter(name for node in nodes for name in _bound_names(node))
        uses = {}
        for node in nodes:
            if isinstance(node, ast.Name):
                uses.setdefault(node.id, []).append(node)
        reserved = set(uses) | set(bindings)
        namespace_keys = {
            node.value for node in nodes if isinstance(node, ast.Constant)
            and isinstance(node.value, str) and node.value.isidentifier()
        }
        dynamic = {"globals", "locals", "vars", "eval", "exec"} & uses.keys()
        # A wildcard import can bind or overwrite a name the tree cannot see.
        dynamic = dynamic or any(isinstance(node, ast.alias) and node.name == "*" for node in nodes)
        self.modules = {}
        self.functions = {}
        self.imports = {}
        self.spellings = {}

        def can_rebind(name):
            return bindings[name] == 1 and not dynamic and name not in namespace_keys

        for node in nodes:
            if isinstance(node, ast.ImportFrom) and node.level == 0 and node.module == _PACKAGE:
                aliases = [(alias, alias.name) for alias in node.names]
            elif isinstance(node, ast.Import):
                prefix = _PACKAGE + "."
                aliases = [(alias, alias.name[len(prefix):]) for alias in node.names
                           if alias.asname and alias.name.startswith(prefix)]
            else:
                continue
            if not any(family in _MODULES for _, family in aliases):
                continue
            self._save_spellings(node)
            for alias, family in aliases:
                module = _MODULES.get(family)
                local = alias.asname or alias.name
                if not module or not can_rebind(local):
                    continue
                if all(self._can_lower(use, module, parents) for use in uses.get(local, [])):
                    name = self._local_spelling(alias) if alias.asname else _available_name(module, reserved)
                    self.modules[local] = (module, name)
                    self.imports[alias] = f"import {module}" if name == module else f"import {module} as {name}"

        for node in nodes:
            if not isinstance(node, ast.ImportFrom) or node.level or not node.module:
                continue
            prefix = _PACKAGE + "."
            if not node.module.startswith(prefix):
                continue
            module = _MODULES.get(node.module[len(prefix):])
            if not module:
                continue
            self._save_spellings(node)
            exports = _EXPORTS[module]
            for alias in node.names:
                target = exports.get(alias.name, "")
                if not target.isidentifier() or target in _WRAPPED:
                    continue
                name = self._local_spelling(alias)
                if not alias.asname and can_rebind(alias.name):
                    name = _available_name(target, reserved)
                    self.functions[alias.name] = name
                statement = f"from {module} import {target}"
                self.imports[alias] = statement if name == target else f"{statement} as {name}"

    def _save_spellings(self, node):
        self.spellings.update(zip(node.names, self.source.import_spellings(node)))

    def _local_spelling(self, alias):
        return self.spellings[alias].split()[-1]

    @staticmethod
    def _can_lower(use, module, parents):
        attribute = parents.get(use)
        if not isinstance(attribute, ast.Attribute) or not isinstance(attribute.ctx, ast.Load):
            return False
        target = _EXPORTS[module].get(attribute.attr)
        if target not in _WRAPPED:
            return target is not None
        call = parents.get(attribute)
        return isinstance(call, ast.Call) and call.func is attribute and _simple_wrapper_call(call, target, attribute.attr)

    def visit_Import(self, node):
        if not any(alias in self.imports for alias in node.names):
            return
        if isinstance(node, ast.ImportFrom):
            prefix = f"from {'.' * node.level}{node.module or ''} import "
        else:
            prefix = "import "
        statements = [
            self.imports[alias] if alias in self.imports else prefix + self.spellings[alias]
            for alias in node.names
        ]
        start, _ = self.source.span(node)
        indent = self.source.data[self.source.lines[node.lineno - 1]:start].decode("utf-8")
        separator = "; " if indent.strip() else self.source.newline + indent
        self.source.replace(node, separator.join(statements))

    visit_ImportFrom = visit_Import

    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Load) and node.id in self.functions:
            self.source.replace(node, self.functions[node.id])

    def _member(self, node):
        if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            binding = self.modules.get(node.value.id)
            if binding:
                module, name = binding
                return name, _EXPORTS[module][node.attr]
        return None

    def visit_Attribute(self, node):
        member = self._member(node)
        if not member:
            self.generic_visit(node)
            return
        name, target = member
        self.source.replace(node, f"{name}.{target}")

    def _argument(self, node):
        start, end = self.source.span(node)
        mark = len(self.source.edits)
        self.visit(node)
        edits = self.source.edits[mark:]
        del self.source.edits[mark:]
        text = self.source.render(start, end, edits)
        return f"({text})" if isinstance(node, ast.NamedExpr) else text

    def visit_Call(self, node):
        member = self._member(node.func)
        if not member or member[1] not in _WRAPPED:
            self.generic_visit(node)
            return
        name, target = member
        arguments = [self._argument(arg) for arg in node.args]
        if target == "timedelta":
            units = ["days", "hours", "minutes", "seconds", "weeks"]
            named = [f"{unit}={value}" for unit, value in zip(units, arguments)]
            named.extend(f"{_DURATION_UNITS[item.arg]}={self._argument(item.value)}" for item in node.keywords)
            replacement = f"{name}.timedelta({', '.join(named)})"
        else:
            pattern = len(node.args) == 2 and node.args[1].value is not None
            if target == "parse":
                method = "strptime" if pattern else "fromisoformat"
                args = arguments if pattern else arguments[:1]
                replacement = f"{name}.datetime.{method}({', '.join(args)})"
            else:
                method = "strftime" if pattern else "isoformat"
                value = arguments[0]
                if not isinstance(node.args[0], (ast.Name, ast.Attribute, ast.Call, ast.Subscript)):
                    value = f"({value})"
                replacement = f"{value}.{method}({arguments[1] if pattern else ''})"
        self.source.replace(node, replacement)


def python_preview(python_code):
    """Translate bundled library calls without rewriting user names or literals."""
    if "balkh" not in python_code:
        return python_code
    tree = ast.parse(python_code)
    source = _Source(python_code)
    try:
        library = _StandardLibrary(tree, source)
        if not library.imports:
            return python_code
        library.visit(tree)
        rendered = source.render(0, len(source.data), source.edits)
        rendered_tree = ast.parse(rendered)
    except (RecursionError, SyntaxError, tokenize.TokenError):
        # Keep valid source when the library references cannot be lowered safely.
        return python_code
    # Debug f-strings include the expression spelling in the displayed text.
    if _string_literals(tree) != _string_literals(rendered_tree):
        return python_code
    return rendered


def _string_literals(tree):
    return Counter(node.value for node in ast.walk(tree)
                   if isinstance(node, ast.Constant) and isinstance(node.value, (str, bytes)))
