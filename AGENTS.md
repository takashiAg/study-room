# Study Roomの変更手順

## 守る境界

- 公開するのはアプリ、スキル、オリジナルのデモだけ。書籍PDF・EPUB・原文、個人用設問、学習履歴、パスワードは追加しない。隣の `software-architecture-the-hard-parts/data/` は個人用データ領域。
- `src/core/domain` は純粋なルールと型。`src/core/application` はdomainとポートに依存。coreからReact・adapter・DOM・ストレージ・fetchを参照しない。
- `src/adapters/inbound/react` はユースケースを呼ぶUI。`src/adapters/outbound/browser` が保存・暗号化・ダウンロードを実装。相互の具体実装を直接結合せず `src/main.tsx` で組み立てる。
- importするJSONは未知のデータとして検証する。書籍本文を未確認の問題は `supplemental`、メモ由来は `notes` とし、`book` と偽らない。
- 問題を差し替えても受験履歴の問題スナップショットを変更しない。得点は単一選択の均等配点。自由記述やメモを自動採点しない。
- 暗号化はブラウザ側のデータ保護であり、サーバー認証とは説明しない。公開テストパスワードを個人データに使わない。

## 開発ハーネス

Node.js 24で `npm ci`。デモの準備は以下。これは公開デモだけに使う。

```sh
printf '%s\n' 'e2e-only-password-1234' | npm run prepare:data -- examples/catalog.json
```

変更箇所に対応するテストを実行し、納品前に型・境界・全テスト・ビルドを確認する。

```sh
npm run typecheck
npm run check:architecture
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

coreのテストは `tests/unit`、UIは `tests/ui`、実ブラウザは `tests/e2e`。UIだけの確認は `npm run test:ui`。E2Eはビルドしたpreviewを使用するためソースやvault変更後は再ビルドする。デスクトップとモバイルを両方維持する。

CIでは依存方向のチェックも必須。新しいadapterを追加した場合は境界ルールとの整合を確認する。生成物・Playwrightのtrace・個人のダウンロードをGitに追加しない。Git操作はこのリポジトリ内の対象ファイルに限定する。

## スキルと仕様

`skills/create-study-questions` と `skills/review-study-results` は個別インストールされる。参照資料をスキル内に同梱し、`../../src` などインストール先にないファイルへ依存させない。設問仕様の変更時はdomainのvalidator、デモ、生成スキルの `references/question-set.md` を揃える。

CI ActionsはコミットSHA固定。Dependabot更新でも既存テストを通し、自動マージ・自動デプロイを勝手に追加しない。
