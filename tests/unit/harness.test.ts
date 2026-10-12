import { afterEach, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { unseal } from "../../src/adapters/outbound/browser/crypto";
const temporary: string[] = [];
const workspace = () => {
  const dir = mkdtempSync(join(tmpdir(), "study-harness-"));
  temporary.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of temporary.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
it("architecture harness rejects nested re-export, dynamic and type dependencies", () => {
  const dir = workspace();
  mkdirSync(join(dir, "src/core/domain/nested"), { recursive: true });
  const fixture = join(dir, "src/core/domain/nested/fixture.ts");
  const run = () =>
    spawnSync(process.execPath, [resolve("scripts/check-architecture.mjs")], {
      cwd: dir,
      encoding: "utf8",
    });
  writeFileSync(fixture, "export const grade = (value: number) => value;");
  expect(run().status).toBe(0);
  for (const code of [
    "export * from '../../../adapters/outbound/browser/browser';",
    "const value = import('../../../adapters/outbound/browser/browser');",
    "type Value = import('../../../adapters/inbound/react/App').Value;",
    "const value = window.localStorage;",
  ]) {
    writeFileSync(fixture, code);
    const result = run();
    expect(result.status, result.stdout + result.stderr).toBe(1);
  }
});
it("encryption CLI validates before output and emits only an encrypted, normalized catalog", async () => {
  const dir = workspace(),
    source = join(dir, "input.json");
  const run = () =>
    spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        resolve("scripts/encrypt-data.mjs"),
        source,
      ],
      { cwd: dir, encoding: "utf8", input: "test-only-password-1234\n" },
    );
  const catalog = JSON.parse(
    readFileSync(resolve("examples/catalog.json"), "utf8"),
  );
  const invalid = structuredClone(catalog);
  invalid.chapters[0].id = -1;
  writeFileSync(source, JSON.stringify(invalid));
  expect(run().status).not.toBe(0);
  expect(existsSync(join(dir, "public/vault.json"))).toBe(false);
  catalog.privateExtra = "SHOULD_NEVER_EXPORT";
  writeFileSync(source, JSON.stringify(catalog));
  const result = run();
  expect(result.status, result.stderr).toBe(0);
  const raw = readFileSync(join(dir, "public/vault.json"), "utf8");
  expect(raw).not.toContain(catalog.book);
  expect(raw).not.toContain("SHOULD_NEVER_EXPORT");
  const decrypted = await unseal(JSON.parse(raw), "test-only-password-1234");
  expect(decrypted).toHaveProperty("book", catalog.book);
  expect(decrypted).not.toHaveProperty("privateExtra");
}, 15000);
