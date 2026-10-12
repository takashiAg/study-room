import { useEffect, useState, type ChangeEvent } from "react";
import type { StudyUseCases } from "../../../core/application/ports";
import type { Attempt, StudyState } from "../../../core/domain/model";
import { grade, sourceLabel } from "../../../core/domain/study";
import { Brand, LoginView, QuizView, ResultView } from "./views";
export function App({ service }: { service: StudyUseCases }) {
  const [state, setState] = useState<StudyState | null>(null),
    [selected, setSelected] = useState(8),
    [screen, setScreen] = useState<"home" | "quiz" | "result">("home"),
    [result, setResult] = useState<Attempt | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen, state === null]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理に失敗しました。");
    } finally {
      setBusy(false);
    }
  }
  function notify(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(""), 5000);
  }
  function download(action: () => void) {
    try {
      action();
      notify("ダウンロードを開始しました。");
    } catch (e) {
      setError(String(e));
    }
  }
  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("2MB以下のJSONファイルを選んでください。");
      return;
    }
    await run(async () => {
      const next = await service.importQuestions(await file.text());
      setState(next);
      const imported = JSON.parse(await file.text());
      setSelected(imported.chapter.id);
      notify("問題セットをインポートしました。");
    });
  }
  async function restoreFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10_000_000) {
      setError("10MB以下のバックアップを選んでください。");
      return;
    }
    if (!confirm("現在の問題・履歴をバックアップの内容で置き換えますか？"))
      return;
    await run(async () => {
      const next = await service.restoreBackup(await file.text());
      setState(next);
      setSelected(next.draft?.chapterId ?? next.catalog.chapters[0].id);
      setScreen("home");
      setResult(null);
      notify("バックアップを復元しました。");
    });
  }
  if (!state)
    return (
      <LoginView
        busy={busy}
        error={error}
        onUnlock={(password) =>
          run(async () => {
            const s = await service.unlock(password);
            setState(s);
            setSelected(
              s.draft?.chapterId ??
                s.catalog.chapters.find((c) => c.id === 8)?.id ??
                s.catalog.chapters[0].id,
            );
            setScreen("home");
          })
        }
      />
    );
  const chapter =
    state.catalog.chapters.find((c) => c.id === selected) ??
    state.catalog.chapters[0];
  const attempts = state.attempts.filter((a) => a.chapter.id === chapter.id),
    scores = attempts.map((a) => grade(a.chapter, a.answers).score);
  const start = () =>
    run(async () => {
      setState(await service.start(chapter.id));
      setScreen("quiz");
    });
  const goChapter = (id: number) => {
    if (screen === "quiz") {
      notify("テストを終了してから章を切り替えてください。");
      return;
    }
    setSelected(id);
    setScreen("home");
    setError("");
  };
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <div className="eyebrow">YOUR READING PATH</div>
        <nav aria-label="章を選ぶ">
          {state.catalog.chapters.map((c) => (
            <button
              key={c.id}
              disabled={busy}
              className={`nav-chapter ${c.id === chapter.id ? "active" : ""}`}
              onClick={() => goChapter(c.id)}
              aria-current={c.id === chapter.id ? "page" : undefined}
            >
              <span className="num">{String(c.id).padStart(2, "0")}</span>
              <span>{c.title}</span>
              {c.questions.length > 0 && (
                <span className="dot" aria-label="問題あり" />
              )}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          自分のペースで、一章ずつ。
          <br />
          READ · PRACTICE · REFLECT
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <strong>{state.catalog.book}</strong>
          <select
            disabled={busy}
            className="mobile-select"
            aria-label="章を選択"
            value={chapter.id}
            onChange={(e) => goChapter(Number(e.target.value))}
          >
            {state.catalog.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}章 {c.title}
              </option>
            ))}
          </select>
          <div className="row">
            <span className="badge green">● ローカル保存</span>
            <button
              className="text-btn"
              disabled={busy}
              onClick={() => {
                service.lock();
                setState(null);
                setResult(null);
                setError("");
              }}
            >
              ロック
            </button>
          </div>
        </header>
        <main className="main">
          {error && (
            <div className="warn-box" role="alert">
              {error}
            </div>
          )}
          {screen === "quiz" && state.draft ? (
            <QuizView
              key={`${state.draft.chapterId}-${state.draft.index}`}
              chapter={state.catalog.chapters.find(
                (c) => c.id === state.draft!.chapterId,
              )!}
              draft={state.draft}
              busy={busy}
              onNext={(answer, note) =>
                run(async () => {
                  const last =
                    state.draft!.index === state.draft!.answers.length - 1;
                  const next = await service.answer(
                    state.draft!.index,
                    answer,
                    note,
                  );
                  setState(next);
                  if (last) {
                    const a = await service.finish();
                    setState(service.snapshot());
                    setResult(a);
                    setScreen("result");
                  }
                })
              }
              onBack={() => {
                const next = structuredClone(state);
                next.draft!.index--;
                setState(next);
              }}
              onExit={() => {
                if (confirm("進行中の回答を破棄して章のページへ戻りますか？"))
                  run(async () => {
                    setState(await service.abandon());
                    setScreen("home");
                  });
              }}
            />
          ) : screen === "result" && result ? (
            <ResultView
              busy={busy}
              attempt={result}
              onReport={() => download(() => service.downloadReport(result))}
              onRetry={start}
              onHome={() => setScreen("home")}
            />
          ) : (
            <>
              <section className="hero">
                <div>
                  <div className="eyebrow muted">YOUR NEXT SMALL STEP</div>
                  <h1>{chapter.title}</h1>
                  <p>{chapter.description}</p>
                </div>
                <div className="chapter-art" aria-hidden="true">
                  {String(chapter.id).padStart(2, "0")}
                  <small>CHAPTER</small>
                </div>
              </section>
              <span className="badge amber">
                {chapter.questions.length
                  ? sourceLabel(chapter)
                  : "本文・読書メモから問題を追加できます"}
              </span>
              <div className="stats">
                <div className="stat">
                  <p>この章のベストスコア</p>
                  <strong>
                    {scores.length ? Math.max(...scores) : "—"}
                    <small>/ 100</small>
                  </strong>
                </div>
                <div className="stat">
                  <p>この章の受験回数</p>
                  <strong>
                    {attempts.length}
                    <small>回</small>
                  </strong>
                </div>
                <div className="stat">
                  <p>今回の問題数</p>
                  <strong>
                    {chapter.questions.length}
                    <small>問</small>
                  </strong>
                </div>
              </div>
              {state.draft && (
                <div className="warn-box row space">
                  <span>{state.draft.chapterId}章のテストが途中です。</span>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setSelected(state.draft!.chapterId);
                      setScreen("quiz");
                    }}
                  >
                    続きから再開
                  </button>
                  <button
                    className="text-btn"
                    disabled={busy}
                    onClick={() => {
                      if (confirm("保存済みの途中回答を破棄しますか？"))
                        run(async () => setState(await service.abandon()));
                    }}
                  >
                    途中回答を破棄
                  </button>
                </div>
              )}
              <section className="study-card">
                <div>
                  <div className="eyebrow">CHECK YOUR UNDERSTANDING</div>
                  <h2>
                    {chapter.questions.length
                      ? "読んだことを、確かめよう。"
                      : "あなたの資料から、学びを作ろう。"}
                  </h2>
                  <p>
                    {chapter.questions.length
                      ? `${chapter.questions.length}問の選択式テスト。採点後にすべての解説を確認できます。`
                      : "設問作成スキルに本文や読書メモを渡し、できたJSONをインポートしてください。"}
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={busy || !chapter.questions.length || !!state.draft}
                  onClick={start}
                >
                  テストをはじめる →
                </button>
              </section>
              {!!chapter.questions.length && (
                <>
                  <p className="source-note">{chapter.source}</p>
                  <div className="topics">
                    {[...new Set(chapter.questions.map((q) => q.topic))].map(
                      (t) => (
                        <span className="topic" key={t}>
                          {t}
                        </span>
                      ),
                    )}
                  </div>
                </>
              )}
              <div className="section-title">
                <h2>学びを、持ち出す・取り込む</h2>
              </div>
              <div className="tools-grid">
                <section className="tool-card">
                  <span className="eyebrow muted">IMPORT</span>
                  <h3>資料から作った問題で学ぶ</h3>
                  <p>
                    PDFや読書メモをClaude /
                    Codexに渡して問題を作成。JSONを読み込むと、その章の問題を置き換えます。
                  </p>
                  <label
                    className={`secondary upload-label ${busy ? "muted" : ""}`}
                  >
                    ＋ 問題をインポート
                    <input
                      type="file"
                      className="sr-only"
                      aria-label="問題をインポート"
                      accept=".json,application/json"
                      onChange={importFile}
                      disabled={busy || !!state.draft}
                    />
                  </label>
                  <p className="footnote">
                    インポートした問題はこのブラウザだけに保存されます。
                  </p>
                </section>
                <section className="tool-card">
                  <span className="eyebrow muted">EXPORT</span>
                  <h3>記録を、自分の手元に</h3>
                  <p>
                    受験結果はMarkdown、点数の一覧はCSVに。設問データもJSONで保存できます。
                  </p>
                  <div className="row">
                    <button
                      className="secondary"
                      disabled={!state.attempts.length}
                      onClick={() => download(() => service.downloadScores())}
                    >
                      ↓ 点数一覧 CSV
                    </button>
                    <button
                      className="secondary"
                      disabled={!chapter.questions.length}
                      onClick={() =>
                        download(() => service.downloadQuestions(chapter.id))
                      }
                    >
                      ↓ 設問 JSON
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => download(() => service.downloadBackup())}
                    >
                      ↓ 全体バックアップ JSON
                    </button>
                    <label className="secondary upload-label">
                      バックアップを復元
                      <input
                        className="sr-only"
                        type="file"
                        aria-label="バックアップを復元"
                        accept=".json,application/json"
                        disabled={busy || !!state.draft}
                        onChange={restoreFile}
                      />
                    </label>
                  </div>
                  <p className="footnote">
                    バックアップには設問・回答・メモ・履歴が平文で含まれます。安全な場所に保管してください。
                  </p>
                </section>
              </div>
              <div className="section-title">
                <h2>この章の学習履歴</h2>
                <span className="muted" style={{ fontSize: 11 }}>
                  記録はブラウザ内に保存
                </span>
              </div>
              <div className="history-wrap">
                {attempts.length ? (
                  <table>
                    <thead>
                      <tr>
                        <th>受験日時</th>
                        <th>スコア</th>
                        <th>正答数</th>
                        <th>レポート</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attempts.map((a) => {
                        const g = grade(a.chapter, a.answers);
                        return (
                          <tr key={a.id}>
                            <td>{new Date(a.date).toLocaleString("ja-JP")}</td>
                            <td>
                              <strong>{g.score}</strong> / 100
                            </td>
                            <td>
                              {g.correct} / {g.total}
                            </td>
                            <td>
                              <button
                                className="text-btn"
                                onClick={() => {
                                  setResult(a);
                                  setScreen("result");
                                }}
                              >
                                結果
                              </button>
                              <button
                                className="text-btn"
                                onClick={() =>
                                  download(() => service.downloadReport(a))
                                }
                              >
                                ↓ MD
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty">
                    まだ受験記録がありません。最初の一回から、理解の変化を残しましょう。
                  </div>
                )}
              </div>
              <p className="footnote">
                点数はこの問題セットに対する正答率です。書籍全体の理解度や設計能力を保証するものではありません。
                <br />
                端末変更やブラウザのデータ削除に備えて、必要なレポート・設問・点数をダウンロードしてください。
              </p>
              <p className="footnote">
                <a
                  href="https://github.com/takashiAg/study-room#skills"
                  target="_blank"
                  rel="noreferrer"
                >
                  設問作成・復習スキルの使い方 ↗
                </a>
              </p>
            </>
          )}
        </main>
      </div>
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </div>
  );
}
