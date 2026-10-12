import { describe, it, expect, vi } from "vitest";
import type { Chapter, StudyState } from "../../src/core/domain/model";
import {
  grade,
  markdownReport,
  scoresCsv,
  validateQuestionSet,
  validateStudyState,
} from "../../src/core/domain/study";
import { StudyService } from "../../src/core/application/study-service";
const chapter: Chapter = {
  id: 8,
  title: "再利用",
  description: "練習",
  kind: "supplemental",
  source: "本文未確認",
  questions: [
    {
      id: "q1",
      topic: "結合",
      section: "一般論",
      prompt: "どれ？",
      options: ["A", "B"],
      answer: 0,
      explanation: "理由",
    },
  ],
};
const initial = (): StudyState => ({
  catalog: {
    book: "Book",
    version: "v1",
    chapters: [
      structuredClone(chapter),
      { ...structuredClone(chapter), id: 9 },
    ],
  },
  attempts: [],
  draft: null,
});
function setup() {
  const save = vi.fn(async (_s: StudyState) => {}),
    download = vi.fn();
  const service = new StudyService(
    { unlock: async () => initial(), save, lock: vi.fn() },
    { save: download },
    { now: () => "2026-10-12T00:00:00Z" },
    { next: () => "attempt-1" },
  );
  return { service, save, download };
}
describe("study use cases without browser or UI", () => {
  it("tracks versions per chapter and freezes attempted questions", async () => {
    const { service } = setup();
    await service.unlock("pw");
    await service.importQuestions(
      JSON.stringify({ format: 1, book: "Book", version: "v2", chapter }),
    );
    await service.start(9);
    expect(service.snapshot().draft?.version).toBe("v1");
    await service.answer(0, 0, "My note");
    const attempt = await service.finish();
    expect(grade(attempt.chapter, attempt.answers).score).toBe(100);
    attempt.chapter.title = "mutated";
    expect(service.snapshot().attempts[0].chapter.title).toBe("再利用");
    await service.start(8);
    expect(service.snapshot().draft?.version).toBe("v2");
  });
  it("leaves state unchanged when persistence fails", async () => {
    const { service, save } = setup();
    await service.unlock("pw");
    save.mockRejectedValueOnce(new Error("quota"));
    await expect(service.start(8)).rejects.toThrow("quota");
    expect(service.snapshot().draft).toBeNull();
  });
  it("rejects concurrent writes and does not reopen after locking during a save", async () => {
    const { service, save } = setup();
    await service.unlock("pw");
    let resolve!: () => void;
    save.mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const pending = service.start(8);
    await expect(service.start(9)).rejects.toThrow("保存");
    service.lock();
    resolve();
    await expect(pending).rejects.toThrow("ロック");
    expect(() => service.snapshot()).toThrow();
  });
  it("does not lose an active draft or finish incomplete answers", async () => {
    const { service } = setup();
    await service.unlock("pw");
    await service.start(8);
    await expect(service.start(9)).rejects.toThrow();
    await expect(service.finish()).rejects.toThrow();
    expect(service.snapshot().attempts).toHaveLength(0);
  });
  it("restores validated backup and rejects a different book", async () => {
    const { service } = setup();
    await service.unlock("pw");
    await service.start(8);
    await service.answer(0, 1, "Review");
    await service.finish();
    const backup = service.snapshot();
    await service.restoreBackup(JSON.stringify(initial()));
    expect(service.snapshot().attempts).toHaveLength(0);
    await service.restoreBackup(JSON.stringify(backup));
    expect(service.snapshot().attempts).toHaveLength(1);
    const bad = initial();
    bad.catalog.book = "Other";
    await expect(service.restoreBackup(JSON.stringify(bad))).rejects.toThrow();
  });
  it("exports the selected chapter version and complete learning report", async () => {
    const { service, download } = setup();
    await service.unlock("pw");
    await service.importQuestions(
      JSON.stringify({ format: 1, book: "Book", version: "v2", chapter }),
    );
    service.downloadQuestions(9);
    expect(JSON.parse(download.mock.calls[0][1]).version).toBe("v1");
    await service.start(8);
    await service.answer(0, 1, "Why?");
    const a = await service.finish();
    const report = markdownReport(a);
    for (const text of [
      "0 / 100",
      "どれ？",
      "自分の回答：B",
      "正解：A",
      "理由",
      "Why?",
      "Claude / Codex",
    ])
      expect(report).toContain(text);
  });
});
describe("untrusted data and scoring", () => {
  it.each([
    null,
    {},
    {
      format: 1,
      book: "Book",
      version: "1",
      chapter: {
        ...chapter,
        questions: [{ ...chapter.questions[0], answer: 5 }],
      },
    },
  ])("rejects malformed question sets %j", (v) =>
    expect(() => validateQuestionSet(v)).toThrow(),
  );
  it("rejects duplicate question IDs and discards unsupported fields", () => {
    expect(() =>
      validateQuestionSet({
        format: 1,
        book: "Book",
        version: "1",
        chapter: {
          ...chapter,
          questions: [...chapter.questions, ...chapter.questions],
        },
      }),
    ).toThrow();
    expect(
      validateQuestionSet({
        format: 1,
        book: "Book",
        version: "1",
        chapter,
        execute: "evil",
      }),
    ).not.toHaveProperty("execute");
  });
  it("rejects corrupt drafts and history before restoration", () => {
    const s = initial();
    s.draft = {
      chapterId: 8,
      version: "v1",
      answers: [9],
      notes: [""],
      index: 0,
    };
    expect(() => validateStudyState(s)).toThrow();
    s.draft = null;
    s.attempts = [
      {
        id: "a",
        book: "Book",
        version: "v1",
        chapter,
        date: "invalid",
        answers: [0],
        notes: [""],
      },
    ];
    expect(() => validateStudyState(s)).toThrow();
  });
  it("grades equal weights, rejects missing and out-of-range answers", () => {
    const c = {
      ...chapter,
      questions: [
        ...chapter.questions,
        ...chapter.questions,
        ...chapter.questions,
      ],
    };
    expect(grade(c, [0, 1, 1]).score).toBe(33);
    for (const a of [[null], [2], []])
      expect(() => grade(chapter, a)).toThrow();
  });
  it("escapes CSV quotes and spreadsheet formulas including whitespace", () => {
    const csv = scoresCsv([
      {
        id: "a",
        book: " =DANGEROUS()",
        version: "1",
        date: "2026-10-12",
        chapter: { ...chapter, title: 'title,"quoted"' },
        answers: [0],
        notes: [""],
      },
    ]);
    expect(csv).toContain('"\' =DANGEROUS()"');
    expect(csv).toContain('"title,""quoted"""');
    expect(csv.startsWith("\ufeff")).toBe(true);
  });
});
