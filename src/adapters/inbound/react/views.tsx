import { useState } from "react";
import type { Attempt, Chapter, Draft } from "../../../core/domain/model";
import { grade, level, sourceLabel } from "../../../core/domain/study";
export function Brand() {
  return (
    <div className="brand">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
      Study Room<span className="sr-only">学習室</span>
    </div>
  );
}
export function LoginView({
  onUnlock,
  busy,
  error,
}: {
  onUnlock: (p: string) => void;
  busy: boolean;
  error: string;
}) {
  const [password, setPassword] = useState(""),
    [show, setShow] = useState(false);
  return (
    <div className="login">
      <section className="login-story">
        <Brand />
        <div>
          <div className="eyebrow">
            A little practice. A deeper understanding.
          </div>
          <h1 className="serif">
            読んだ知識を、
            <br />
            自分の言葉に。
          </h1>
          <p>
            章ごとの小さなテストで、理解を確かめる。
            <br />
            つまずいたところは、次の学びの入り口です。
          </p>
          <div className="arch-art" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <footer className="eyebrow">Read · Practice · Reflect</footer>
      </section>
      <section className="login-panel">
        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) onUnlock(password);
          }}
        >
          <span className="badge green">あなたの学習スペース</span>
          <h2>学習室を開く</h2>
          <p className="muted">
            パスワードを入力して、
            <br />
            前回の続きから学びましょう。
          </p>
          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            disabled={busy}
            autoComplete="current-password"
            className="input"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          <button
            type="button"
            className="text-btn"
            onClick={() => setShow(!show)}
          >
            {show ? "パスワードを隠す" : "パスワードを表示"}
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy || !password}>
            {busy ? "開いています…" : "学習室に入る"}
            <span aria-hidden="true">→</span>
          </button>
          <div className="notice">
            問題と学習履歴はブラウザ内で扱います。
            <br />
            履歴はこのブラウザに暗号化して保存されます。
          </div>
        </form>
      </section>
    </div>
  );
}
export function QuizView({
  chapter,
  draft,
  busy,
  onNext,
  onBack,
  onExit,
}: {
  chapter: Chapter;
  draft: Draft;
  busy: boolean;
  onNext: (answer: number, note: string) => void;
  onBack: () => void;
  onExit: () => void;
}) {
  const index = draft.index,
    q = chapter.questions[index];
  const [answer, setAnswer] = useState<number | null>(draft.answers[index]);
  const [note, setNote] = useState(draft.notes[index]);
  return (
    <>
      <div className="quiz-head">
        <div className="row space">
          <span className="eyebrow">
            CHAPTER {String(chapter.id).padStart(2, "0")} · PRACTICE
          </span>
          <button className="text-btn" onClick={onExit} disabled={busy}>
            テストを終了
          </button>
        </div>
        <div className="row space">
          <h2>{chapter.title}</h2>
          <span className="muted">
            {index + 1} / {chapter.questions.length}
          </span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="テストの進捗"
          aria-valuenow={index + 1}
          aria-valuemin={0}
          aria-valuemax={chapter.questions.length}
        >
          <div
            style={{
              width: `${((index + 1) / chapter.questions.length) * 100}%`,
            }}
          />
        </div>
      </div>
      <section className="question-card">
        <div className="row space">
          <span className="badge green">{q.topic}</span>
          <span className="badge">単一選択</span>
        </div>
        <h1 id="question">{q.prompt}</h1>
        <fieldset
          className="options"
          aria-labelledby="question"
          disabled={busy}
        >
          <legend className="sr-only">回答を1つ選んでください</legend>
          {q.options.map((option, i) => (
            <label className="option" key={i}>
              <input
                type="radio"
                name="answer"
                checked={answer === i}
                onChange={() => setAnswer(i)}
              />
              <span className="letter" aria-hidden="true">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
        <label className="note-label" htmlFor="note">
          考えた理由・あとで聞きたいこと（任意）
        </label>
        <textarea
          id="note"
          placeholder="なぜこの選択肢を選んだ？ 気になった点をメモ。"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={10000}
          disabled={busy}
        />
        <div className="row space quiz-actions">
          <button
            className="secondary"
            onClick={onBack}
            disabled={busy || index === 0}
          >
            ← 前の問題
          </button>
          <button
            className="primary"
            disabled={busy || answer === null}
            onClick={() => answer !== null && onNext(answer, note)}
          >
            {busy
              ? "保存しています…"
              : index === chapter.questions.length - 1
                ? "採点して結果を見る"
                : "次の問題へ →"}
          </button>
        </div>
      </section>
      <p className="source-note">
        {sourceLabel(chapter)}：{chapter.source}
      </p>
      <p className="footnote">
        回答は「次の問題へ」で保存されます。途中で閉じても、保存した続きから再開できます。
      </p>
    </>
  );
}
export function ResultView({
  attempt,
  onReport,
  onRetry,
  onHome,
  busy = false,
}: {
  busy?: boolean;
  attempt: Attempt;
  onReport: () => void;
  onRetry: () => void;
  onHome: () => void;
}) {
  const g = grade(attempt.chapter, attempt.answers);
  return (
    <>
      <div className="row space">
        <span className="eyebrow">YOUR LEARNING REPORT</span>
        <button className="text-btn" disabled={busy} onClick={onHome}>
          章のページへ戻る
        </button>
      </div>
      <section className="result-hero">
        <div
          className="score-ring"
          style={{ "--score": g.score } as React.CSSProperties}
        >
          <div>
            <strong>{g.score}</strong>
            <small>/ 100点</small>
          </div>
        </div>
        <div>
          <span className="badge green">
            {g.correct} / {g.total} 問正解
          </span>
          <h1>{level(g.score)}</h1>
          <p>
            {attempt.chapter.id}章 {attempt.chapter.title}
            <br />
            点数は学習の目安。解説で判断の理由も確かめましょう。
          </p>
        </div>
      </section>
      <div className="row download-row">
        <button className="primary" onClick={onReport}>
          ↓ 問題・回答・解説・得点をMD保存
        </button>
        <button className="secondary" disabled={busy} onClick={onRetry}>
          もう一度受ける
        </button>
      </div>
      <div className="notice">
        Markdownにはあなたの回答とメモ、正解、解説、得点、出典、AIへの復習依頼を含みます。ClaudeやCodexに渡して、気になった点を深掘りできます。
      </div>
      <div className="section-title">
        <h2>一問ずつ、振り返る</h2>
        <span className="badge">各問均等配点</span>
      </div>
      {attempt.chapter.questions.map((q, i) => {
        const correct = q.answer === attempt.answers[i];
        return (
          <details className="review" key={q.id} open={!correct}>
            <summary>
              <span className={correct ? "correct" : "wrong"}>
                {correct ? "✓ 正解" : "↗ 復習"}
              </span>
              <span>
                Q{i + 1} {q.topic}
              </span>
            </summary>
            <div className="review-body">
              <p>{q.prompt}</p>
              <div className="answer-detail">
                <div>あなたの回答：{q.options[attempt.answers[i]]}</div>
                <div>
                  <strong>正解：{q.options[q.answer]}</strong>
                </div>
              </div>
              <h3>解説</h3>
              <p>{q.explanation}</p>
              <p className="muted">参照位置：{q.section}</p>
              {attempt.notes[i] && (
                <>
                  <h3>あなたのメモ</h3>
                  <p style={{ whiteSpace: "pre-wrap" }}>{attempt.notes[i]}</p>
                </>
              )}
            </div>
          </details>
        );
      })}
      <p className="source-note">
        {sourceLabel(attempt.chapter)}：{attempt.chapter.source}
      </p>
    </>
  );
}
