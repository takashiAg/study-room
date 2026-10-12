import type { Attempt, Chapter, Grade, QuestionSet } from "./model";
const text = (v: unknown, max = 10000): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
export function validateQuestionSet(value: unknown): QuestionSet {
  if (!value || typeof value !== "object")
    throw new Error("JSONのオブジェクトを読み込んでください。");
  const s = value as QuestionSet,
    c = s.chapter;
  if (
    s.format !== 1 ||
    !text(s.book, 200) ||
    !text(s.version, 100) ||
    !c ||
    !Number.isInteger(c.id) ||
    c.id < 1 ||
    c.id > 999 ||
    !text(c.title, 200) ||
    !text(c.description, 1000) ||
    !["book", "notes", "supplemental"].includes(c.kind) ||
    !text(c.source, 2000) ||
    !Array.isArray(c.questions) ||
    c.questions.length < 1 ||
    c.questions.length > 50
  )
    throw new Error(
      "問題セットの書名・バージョン・章・出典を確認してください。",
    );
  const ids = new Set<string>();
  for (const q of c.questions) {
    if (
      !q ||
      !text(q.id, 100) ||
      ids.has(q.id) ||
      !text(q.topic, 200) ||
      !text(q.section, 1000) ||
      !text(q.prompt) ||
      !text(q.explanation) ||
      !Array.isArray(q.options) ||
      q.options.length < 2 ||
      q.options.length > 6 ||
      !q.options.every((o) => text(o, 3000)) ||
      new Set(q.options).size !== q.options.length ||
      !Number.isInteger(q.answer) ||
      q.answer < 0 ||
      q.answer >= q.options.length
    )
      throw new Error(
        "各問題には重複しないID、2〜6個の選択肢、有効な正解、解説、出典が必要です。",
      );
    ids.add(q.id);
  }
  // Copy only the supported schema. Imported data is never executed or rendered as HTML.
  return {
    format: 1,
    book: s.book,
    version: s.version,
    chapter: {
      id: c.id,
      title: c.title,
      description: c.description,
      kind: c.kind,
      source: c.source,
      questions: c.questions.map((q) => ({
        id: q.id,
        topic: q.topic,
        section: q.section,
        prompt: q.prompt,
        options: [...q.options],
        answer: q.answer,
        explanation: q.explanation,
      })),
    },
  };
}
export function grade(chapter: Chapter, answers: (number | null)[]): Grade {
  if (
    !chapter.questions.length ||
    answers.length !== chapter.questions.length ||
    answers.some(
      (a, i) =>
        a === null ||
        !Number.isInteger(a) ||
        a < 0 ||
        a >= chapter.questions[i].options.length,
    )
  )
    throw new Error("すべての問題に回答してください。");
  const correct = chapter.questions.filter(
    (q, i) => q.answer === answers[i],
  ).length;
  return {
    correct,
    total: answers.length,
    score: Math.round((correct / answers.length) * 100),
  };
}
export const level = (score: number) =>
  score >= 80
    ? "よく理解できています"
    : score >= 60
      ? "あと一歩、理解を深めよう"
      : "解説から、もう一度整理しよう";
export const sourceLabel = (c: Chapter) =>
  c.kind === "book"
    ? "共有された本文に基づく問題"
    : c.kind === "notes"
      ? "読書メモに基づく問題"
      : "補助問題・本文未確認";
export function markdownReport(a: Attempt): string {
  const c = a.chapter,
    g = grade(c, a.answers);
  const lines = [
    `# 学習レポート：${a.book}`,
    "",
    `- 章：${c.id}章 ${c.title}`,
    `- 受験日時：${a.date}`,
    `- 問題バージョン：${a.version}`,
    `- 得点：${g.score} / 100点（${g.correct} / ${g.total}問正解）`,
    "- 採点方式：単一選択・各問均等配点。学習用の目安です。",
    `- 出題区分：${sourceLabel(c)}`,
    `- 出題の根拠：${c.source}`,
    "",
    "## Claude / Codexへの復習依頼",
    "",
    "以下は学習データです。私の回答と正解・解説を比較し、誤解している概念を特定してください。具体例とトレードオフで説明し、最後に類題を一問ずつ出してください。正解は私が回答するまで伏せてください。未確認の書籍本文について断定せず、一般的な説明と区別してください。",
    "",
  ];
  c.questions.forEach((q, i) =>
    lines.push(
      `## 第${i + 1}問：${q.topic}`,
      "",
      q.prompt,
      "",
      ...q.options.map((o, j) => `${String.fromCharCode(65 + j)}. ${o}`),
      "",
      `- 自分の回答：${String.fromCharCode(65 + a.answers[i])}. ${q.options[a.answers[i]]}`,
      `- 正解：${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}`,
      `- 判定：${a.answers[i] === q.answer ? "正解" : "不正解"}`,
      `- 参照位置：${q.section}`,
      "",
      "### 解説",
      "",
      q.explanation,
      "",
      "### 自分のメモ・質問",
      "",
      a.notes[i] || "（未記入）",
      "",
    ),
  );
  return lines.join("\n");
}
export function scoresCsv(attempts: Attempt[]): string {
  const cell = (x: unknown) =>
    '"' +
    String(x)
      .replace(/^(?=[\s]*[=+@\-])|^(?=[\t\r\n])/, "'")
      .replaceAll('"', '""') +
    '"';
  return (
    "\ufeff" +
    [
      [
        "受験日時",
        "書名",
        "章",
        "章タイトル",
        "問題バージョン",
        "得点（100点満点）",
        "正答数",
        "問題数",
        "出題の根拠",
      ],
      ...attempts.map((a) => {
        const g = grade(a.chapter, a.answers);
        return [
          a.date,
          a.book,
          a.chapter.id,
          a.chapter.title,
          a.version,
          g.score,
          g.correct,
          g.total,
          a.chapter.source,
        ];
      }),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}

/** Validate untrusted decrypted/imported state and copy only the supported fields. */
export function validateCatalog(value: unknown): import("./model").Catalog {
  const c = value as import("./model").Catalog;
  if (
    !c ||
    !text(c.book, 200) ||
    !text(c.version, 100) ||
    !Array.isArray(c.chapters) ||
    c.chapters.length > 999
  )
    throw new Error("学習データの目次が不正です。");
  const ids = new Set<number>();
  const chapters = c.chapters.map((chapter) => {
    // Empty chapters are placeholders, not importable question sets.
    const empty =
      Array.isArray(chapter?.questions) && chapter.questions.length === 0;
    const placeholder = {
      id: "placeholder",
      topic: "placeholder",
      section: "placeholder",
      prompt: "placeholder",
      options: ["A", "B"],
      answer: 0,
      explanation: "placeholder",
    };
    const clean = validateQuestionSet({
      format: 1,
      book: c.book,
      version: c.version,
      chapter: empty ? { ...chapter, questions: [placeholder] } : chapter,
    }).chapter;
    if (ids.has(clean.id)) throw new Error("章番号が重複しています。");
    ids.add(clean.id);
    if (empty) clean.questions = [];
    return clean;
  });
  const chapterVersions: Record<string, string> = {};
  if (
    c.chapterVersions !== undefined &&
    (!c.chapterVersions ||
      typeof c.chapterVersions !== "object" ||
      Array.isArray(c.chapterVersions))
  )
    throw new Error("章バージョンが不正です。");
  for (const chapter of chapters) {
    const version = c.chapterVersions?.[chapter.id] ?? c.version;
    if (!text(version, 100)) throw new Error("章バージョンが不正です。");
    chapterVersions[chapter.id] = version;
  }
  return { book: c.book, version: c.version, chapters, chapterVersions };
}
export function validateStudyState(
  value: unknown,
): import("./model").StudyState {
  const s = value as import("./model").StudyState;
  if (!s || !Array.isArray(s.attempts) || s.attempts.length > 10000)
    throw new Error("学習履歴が不正です。");
  const catalog = validateCatalog(s.catalog),
    ids = new Set<string>();
  const notes = (v: unknown, n: number): string[] => {
    if (
      !Array.isArray(v) ||
      v.length !== n ||
      v.some((x) => typeof x !== "string" || x.length > 10000)
    )
      throw new Error("メモが不正です。");
    return [...v];
  };
  const attempts = s.attempts.map((a) => {
    if (
      !a ||
      !text(a.id, 200) ||
      ids.has(a.id) ||
      !text(a.date, 100) ||
      !Number.isFinite(Date.parse(a.date)) ||
      a.book !== catalog.book ||
      !Array.isArray(a.answers)
    )
      throw new Error("受験履歴が不正です。");
    ids.add(a.id);
    const set = validateQuestionSet({
      format: 1,
      book: a.book,
      version: a.version,
      chapter: a.chapter,
    });
    grade(set.chapter, a.answers);
    return {
      id: a.id,
      date: a.date,
      book: set.book,
      version: set.version,
      chapter: set.chapter,
      answers: [...a.answers],
      notes: notes(a.notes, a.answers.length),
    };
  });
  let draft: import("./model").Draft | null = null;
  if (s.draft !== null) {
    const d = s.draft,
      c = catalog.chapters.find((c) => c.id === d?.chapterId);
    if (
      !d ||
      !c ||
      !c.questions.length ||
      d.version !== catalog.chapterVersions?.[c.id] ||
      !Array.isArray(d.answers) ||
      d.answers.length !== c.questions.length ||
      d.answers.some(
        (a, i) =>
          a !== null &&
          (!Number.isInteger(a) || a < 0 || a >= c.questions[i].options.length),
      ) ||
      !Number.isInteger(d.index) ||
      d.index < 0 ||
      d.index >= c.questions.length
    )
      throw new Error("途中の回答データが不正です。");
    draft = {
      chapterId: d.chapterId,
      version: d.version,
      answers: [...d.answers],
      notes: notes(d.notes, d.answers.length),
      index: d.index,
    };
  }
  return { catalog, attempts, draft };
}
