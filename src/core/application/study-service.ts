import type { Attempt, StudyState } from "../domain/model";
import {
  grade,
  markdownReport,
  scoresCsv,
  validateQuestionSet,
  validateStudyState,
} from "../domain/study";
import type {
  Clock,
  DownloadPort,
  IdGenerator,
  StudyRepository,
  StudyUseCases,
} from "./ports";
export class StudyService implements StudyUseCases {
  private state: StudyState | null = null;
  private saving = false;
  private session = 0;
  constructor(
    private repository: StudyRepository,
    private downloads: DownloadPort,
    private clock: Clock,
    private ids: IdGenerator,
  ) {}
  async unlock(password: string) {
    const session = ++this.session;
    const state = validateStudyState(await this.repository.unlock(password));
    if (session !== this.session)
      throw new Error("学習室はロックされています。");
    this.state = state;
    return this.snapshot();
  }
  snapshot(): StudyState {
    if (!this.state) throw new Error("学習室を開いてください。");
    return structuredClone(this.state);
  }
  lock() {
    this.session++;
    this.repository.lock();
    this.state = null;
  }
  private async commit(next: StudyState) {
    if (this.saving) throw new Error("保存が終わってから操作してください。");
    this.saving = true;
    const session = this.session;
    try {
      await this.repository.save(next);
      if (session !== this.session)
        throw new Error("学習室はロックされています。");
      this.state = next;
      return this.snapshot();
    } finally {
      this.saving = false;
    }
  }
  async importQuestions(json: string) {
    if (json.length > 2_000_000)
      throw new Error("問題セットは2MB以下にしてください。");
    const set = validateQuestionSet(JSON.parse(json));
    const next = this.snapshot();
    if (set.book !== next.catalog.book)
      throw new Error(
        `この学習室の書名は「${next.catalog.book}」です。問題セットの書名を合わせてください。`,
      );
    if (next.draft)
      throw new Error(
        "進行中のテストを完了するか、終了してからインポートしてください。",
      );
    next.catalog.chapters = next.catalog.chapters
      .filter((c) => c.id !== set.chapter.id)
      .concat(set.chapter)
      .sort((a, b) => a.id - b.id);
    next.catalog.chapterVersions = {
      ...next.catalog.chapterVersions,
      [set.chapter.id]: set.version,
    };
    return this.commit(next);
  }
  async restoreBackup(json: string) {
    if (json.length > 20_000_000)
      throw new Error("バックアップは20MB以下にしてください。");
    const current = this.snapshot();
    if (current.draft)
      throw new Error(
        "進行中のテストを完了するか、終了してから復元してください。",
      );
    const next = validateStudyState(JSON.parse(json));
    if (next.catalog.book !== current.catalog.book)
      throw new Error("同じ書名のバックアップを選んでください。");
    return this.commit(next);
  }
  async start(chapterId: number) {
    const next = this.snapshot(),
      c = next.catalog.chapters.find((c) => c.id === chapterId);
    if (next.draft)
      throw new Error("進行中のテストを完了するか、終了してください。");
    if (!c?.questions.length)
      throw new Error("この章にはまだ問題がありません。");
    next.draft = {
      chapterId,
      version:
        next.catalog.chapterVersions?.[chapterId] ?? next.catalog.version,
      answers: c.questions.map(() => null),
      notes: c.questions.map(() => ""),
      index: 0,
    };
    return this.commit(next);
  }
  async answer(index: number, answer: number, note: string) {
    const next = this.snapshot(),
      d = next.draft;
    if (!d) throw new Error("テストが開始されていません。");
    const q = next.catalog.chapters.find((c) => c.id === d.chapterId)
      ?.questions[index];
    if (
      !q ||
      !Number.isInteger(answer) ||
      answer < 0 ||
      answer >= q.options.length
    )
      throw new Error("回答を選んでください。");
    d.answers[index] = answer;
    d.notes[index] = note.slice(0, 10000);
    d.index = Math.min(index + 1, d.answers.length - 1);
    return this.commit(next);
  }
  async finish(): Promise<Attempt> {
    const next = this.snapshot(),
      d = next.draft;
    if (!d) throw new Error("テストが開始されていません。");
    const chapter = next.catalog.chapters.find((c) => c.id === d.chapterId)!;
    grade(chapter, d.answers);
    const attempt: Attempt = {
      id: this.ids.next(),
      date: this.clock.now(),
      book: next.catalog.book,
      version: d.version,
      chapter: structuredClone(chapter),
      answers: d.answers as number[],
      notes: [...d.notes],
    };
    next.attempts.unshift(attempt);
    next.draft = null;
    await this.commit(next);
    return structuredClone(attempt);
  }
  async abandon() {
    const next = this.snapshot();
    next.draft = null;
    return this.commit(next);
  }
  downloadReport(attempt: Attempt) {
    this.downloads.save(
      `study-ch${attempt.chapter.id}-${attempt.id.slice(0, 8)}.md`,
      markdownReport(attempt),
      "text/markdown;charset=utf-8",
    );
  }
  downloadScores() {
    this.downloads.save(
      "study-scores.csv",
      scoresCsv(this.snapshot().attempts),
      "text/csv;charset=utf-8",
    );
  }
  downloadBackup() {
    this.downloads.save(
      "study-backup.json",
      JSON.stringify(this.snapshot(), null, 2),
      "application/json",
    );
  }
  downloadQuestions(chapterId: number) {
    const s = this.snapshot(),
      chapter = s.catalog.chapters.find((c) => c.id === chapterId);
    if (!chapter?.questions.length) throw new Error("問題がありません。");
    this.downloads.save(
      `chapter-${chapterId}.json`,
      JSON.stringify(
        {
          format: 1,
          book: s.catalog.book,
          version: s.catalog.chapterVersions?.[chapterId] ?? s.catalog.version,
          chapter,
        },
        null,
        2,
      ),
      "application/json",
    );
  }
}
