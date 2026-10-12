import ts from "typescript";
import { readdir, readFile } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
const root = resolve("src");
const layers = [
  "core/domain",
  "core/application",
  "adapters/inbound",
  "adapters/outbound",
];
const allowed = {
  "core/domain": ["core/domain"],
  "core/application": ["core/domain", "core/application"],
  "adapters/inbound": ["core/domain", "core/application", "adapters/inbound"],
  "adapters/outbound": ["core/domain", "core/application", "adapters/outbound"],
};
const layerOf = (path) => layers.find((layer) => path.startsWith(`${layer}/`));
async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.tsx?$/.test(path)) yield path;
  }
}
const failures = [];
for await (const path of files(root)) {
  const name = relative(root, path),
    layer = layerOf(name);
  if (!layer) continue;
  const ast = ts.createSourceFile(
    path,
    await readFile(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const check = (spec) => {
    if (spec.startsWith(".")) {
      const target = layerOf(relative(root, resolve(dirname(path), spec)));
      if (!allowed[layer].includes(target)) failures.push(`${name} -> ${spec}`);
    } else if (layer.startsWith("core/"))
      failures.push(`${name} imports external package ${spec}`);
  };
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      check(node.moduleSpecifier.text);
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      check(node.argument.literal.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) check(arg.text);
      else failures.push(`${name} uses an uncheckable dynamic import`);
    }
    if (
      layer.startsWith("core/") &&
      ts.isIdentifier(node) &&
      [
        "window",
        "document",
        "localStorage",
        "sessionStorage",
        "fetch",
        "crypto",
        "navigator",
        "indexedDB",
      ].includes(node.text)
    )
      failures.push(`${name} accesses browser API ${node.text}`);
    ts.forEachChild(node, visit);
  };
  visit(ast);
}
if (failures.length) {
  console.error([...new Set(failures)].join("\n"));
  process.exit(1);
}
console.log(
  "Architecture boundaries passed (recursive imports, re-exports, dynamic imports and core browser APIs).",
);
