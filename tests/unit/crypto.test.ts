import { it, expect } from "vitest";
import { seal, unseal } from "../../src/adapters/outbound/browser/crypto";
it("encrypts a randomized authenticated envelope; rejects incorrect passwords and tampering", async () => {
  const data = { notes: "private 日本語", score: 80 };
  const first = await seal(data, "correct horse"),
    second = await seal(data, "correct horse");
  expect(first.ciphertext).not.toContain("private");
  expect(first.salt).not.toBe(second.salt);
  expect(await unseal(first, "correct horse")).toEqual(data);
  await expect(unseal(first, "wrong")).rejects.toThrow();
  await expect(
    unseal(
      {
        ...first,
        ciphertext:
          (first.ciphertext[0] === "A" ? "B" : "A") + first.ciphertext.slice(1),
      },
      "correct horse",
    ),
  ).rejects.toThrow();
}, 15000);
