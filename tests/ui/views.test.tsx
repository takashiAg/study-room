// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LoginView,
  QuizView,
  ResultView,
} from "../../src/adapters/inbound/react/views";
import type { Attempt, Chapter, Draft } from "../../src/core/domain/model";
import catalog from "../../examples/catalog.json";
const chapter = catalog.chapters[0] as Chapter;
const draft: Draft = {
  chapterId: 8,
  version: catalog.version,
  answers: [null, null],
  notes: ["", ""],
  index: 0,
};
afterEach(cleanup);
describe("login UI", () => {
  it("requires a password, supports visibility, and submits only the entered password", async () => {
    const user = userEvent.setup(),
      unlock = vi.fn();
    render(<LoginView busy={false} error="" onUnlock={unlock} />);
    expect(screen.getByRole("button", { name: "学習室に入る" })).toBeDisabled();
    await user.type(screen.getByLabelText("パスワード"), "my-local-password");
    await user.click(screen.getByRole("button", { name: "パスワードを表示" }));
    expect(screen.getByLabelText("パスワード")).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "学習室に入る" }));
    expect(unlock).toHaveBeenCalledWith("my-local-password");
  });
  it("announces unlock errors and prevents duplicate submission while busy", () => {
    render(
      <LoginView
        busy
        error="パスワードを確認してください"
        onUnlock={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "パスワードを確認してください",
    );
    expect(screen.getByLabelText("パスワード")).toBeDisabled();
    expect(screen.getByRole("button", { name: /開いています/ })).toBeDisabled();
  });
});
describe("quiz UI", () => {
  it("requires an answer and passes the chosen answer and note through its inbound callback", async () => {
    const user = userEvent.setup(),
      next = vi.fn();
    render(
      <QuizView
        chapter={chapter}
        draft={draft}
        busy={false}
        onNext={next}
        onBack={vi.fn()}
        onExit={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "次の問題へ →" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "← 前の問題" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "Markdown" }));
    await user.type(
      screen.getByLabelText("考えた理由・あとで聞きたいこと（任意）"),
      "復習に使いたい",
    );
    await user.click(screen.getByRole("button", { name: "次の問題へ →" }));
    expect(next).toHaveBeenCalledWith(0, "復習に使いたい");
  });
  it("restores a previous answer and disables interactions while saving", () => {
    render(
      <QuizView
        chapter={chapter}
        draft={{ ...draft, index: 1, answers: [0, 1], notes: ["", "保存済み"] }}
        busy
        onNext={vi.fn()}
        onBack={vi.fn()}
        onExit={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("radio", { name: "問題セットのJSONをインポートする" }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "問題セットのJSONをインポートする" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "テストを終了" })).toBeDisabled();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "2",
    );
  });
});
describe("results UI", () => {
  it("shows score, correction and note, and exposes report/retry/navigation actions", async () => {
    const user = userEvent.setup(),
      report = vi.fn(),
      retry = vi.fn(),
      home = vi.fn();
    const attempt: Attempt = {
      id: "attempt-1",
      date: "2026-10-12T00:00:00.000Z",
      book: catalog.book,
      version: catalog.version,
      chapter,
      answers: [0, 0],
      notes: ["", "判断に迷った"],
    };
    render(
      <ResultView
        attempt={attempt}
        onReport={report}
        onRetry={retry}
        onHome={home}
      />,
    );
    expect(screen.getByText("50")).toBeVisible();
    expect(screen.getByText("1 / 2 問正解")).toBeVisible();
    expect(screen.getByText(chapter.questions[1].explanation)).toBeVisible();
    expect(screen.getByText("判断に迷った")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /MD保存/ }));
    await user.click(screen.getByRole("button", { name: "もう一度受ける" }));
    await user.click(screen.getByRole("button", { name: "章のページへ戻る" }));
    expect(report).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledOnce();
    expect(home).toHaveBeenCalledOnce();
  });
});
