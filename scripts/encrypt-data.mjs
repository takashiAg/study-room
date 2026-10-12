import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { validateCatalog } from "../src/core/domain/study.ts";
import { seal } from "../src/adapters/outbound/browser/crypto.ts";
const source = process.argv[2] ?? "examples/catalog.json";
const catalog = validateCatalog(JSON.parse(await readFile(source, "utf8")));
let password = "";
if (process.stdin.isTTY) {
  process.stdout.write("Password (16+ characters, input hidden): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  password = await new Promise((resolve, reject) => {
    let value = "";
    const handler = (chunk) => {
      for (const c of chunk.toString()) {
        if (c === "\u0003") {
          process.stdin.off("data", handler);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          reject(new Error("Cancelled"));
          return;
        }
        if (c === "\r" || c === "\n") {
          process.stdin.off("data", handler);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (c === "\u007f") value = value.slice(0, -1);
        else value += c;
      }
    };
    process.stdin.on("data", handler);
  });
} else {
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    password = line;
    break;
  }
}
if (password.length < 16) throw new Error("Use 16 or more characters");
await mkdir("public", { recursive: true });
await writeFile(
  "public/vault.json",
  JSON.stringify(await seal(catalog, password)),
);
console.log("Encrypted catalog prepared. Password was not saved.");
