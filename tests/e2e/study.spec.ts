import { test, expect, type Page, type Download } from "@playwright/test";
import { readFileSync } from "node:fs";
const catalog = JSON.parse(
  readFileSync(new URL("../../examples/catalog.json", import.meta.url), "utf8"),
);
const password = "e2e-only-password-1234";
async function unlock(page: Page) {
  await page.getByLabel("パスワード", { exact: true }).fill(password);
  await page.getByRole("button", { name: "学習室に入る" }).click();
  await expect(
    page.getByRole("button", { name: "テストをはじめる →" }),
  ).toBeVisible();
}
async function contents(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw Error("No download stream");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
async function screenshot(
  page: Page,
  name: string,
  testInfo: import("@playwright/test").TestInfo,
) {
  await page.screenshot({
    path: testInfo.outputPath(name + ".png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test("password, quiz, Markdown/CSV download, encrypted history and lock", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await screenshot(page, "login", testInfo);
  await page.getByLabel("パスワード", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "学習室に入る" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await unlock(page);
  await screenshot(page, "home", testInfo);
  await page.getByRole("button", { name: "テストをはじめる →" }).click();
  await expect(
    page.getByRole("button", { name: "次の問題へ →" }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "Markdown", exact: true }).check();
  await page
    .getByLabel("考えた理由・あとで聞きたいこと（任意）")
    .fill("外部のAIで復習したい");
  await screenshot(page, "quiz", testInfo);
  await page.getByRole("button", { name: "次の問題へ →" }).click();
  await expect(
    page.getByRole("heading", {
      name: catalog.chapters[0].questions[1].prompt,
    }),
  ).toBeVisible();
  await page.reload();
  await unlock(page);
  await page.getByRole("button", { name: "続きから再開" }).click();
  await expect(
    page.getByRole("heading", {
      name: catalog.chapters[0].questions[1].prompt,
    }),
  ).toBeVisible();
  await page
    .getByRole("radio", { name: "Reactのコンポーネントに問題を直接書く" })
    .check();
  await page.getByRole("button", { name: "採点して結果を見る" }).click();
  await expect(page.getByText("1 / 2 問正解")).toBeVisible();
  await expect(page.getByText("50", { exact: true })).toBeVisible();
  await screenshot(page, "result", testInfo);
  const reportPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /MD保存/ }).click();
  const report = await contents(await reportPromise);
  for (const expected of [
    catalog.chapters[0].questions[0].prompt,
    catalog.chapters[0].questions[1].explanation,
    "外部のAIで復習したい",
    "50",
    "Claude",
  ])
    expect(report).toContain(expected);
  await page.getByRole("button", { name: "章のページへ戻る" }).click();
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "↓ 点数一覧 CSV" }).click();
  const csv = await contents(await csvPromise);
  expect(csv).toContain("50");
  expect(csv).toContain("学習室の使い方");
  const backupPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "↓ 全体バックアップ JSON" }).click();
  const backup = await contents(await backupPromise);
  expect(JSON.parse(backup).attempts).toHaveLength(1);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await unlock(page);
  await expect(page.getByRole("table")).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByLabel("バックアップを復元", { exact: true })
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup),
    });
  await expect(page.getByRole("table")).toContainText("50");
  await page.reload();
  await unlock(page);
  await expect(page.getByRole("table")).toContainText("50");
  const stored = await page.evaluate(() =>
    Object.values(localStorage).join(""),
  );
  expect(stored).not.toContain("外部のAIで復習したい");
  await page.getByRole("button", { name: "ロック", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "学習室を開く" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});
test("valid import replaces a chapter; invalid input keeps its current questions", async ({
  page,
}) => {
  await page.goto("/");
  await unlock(page);
  const chapter = {
    ...catalog.chapters[0],
    title: "持ち込んだ資料の章",
    questions: [
      {
        ...catalog.chapters[0].questions[0],
        id: "imported-q1",
        prompt: "インポートした設問ですか？",
        options: ["はい", "いいえ"],
        answer: 0,
      },
    ],
  };
  await page
    .getByLabel("問題をインポート", { exact: true })
    .setInputFiles({
      name: "questions.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: 1,
          book: catalog.book,
          version: "import-v2",
          chapter,
        }),
      ),
    });
  await expect(
    page.getByRole("heading", { name: chapter.title }),
  ).toBeVisible();
  await page
    .getByLabel("問題をインポート", { exact: true })
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{broken json"),
    });
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "テストをはじめる →" }).click();
  await expect(
    page.getByRole("heading", { name: "インポートした設問ですか？" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "はい", exact: true }).check();
  await page.getByRole("button", { name: "採点して結果を見る" }).click();
  await expect(page.getByText("1 / 1 問正解")).toBeVisible();
});
