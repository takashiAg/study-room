# Study Room

React / TypeScriptで作った、章別テストと復習のためのブラウザアプリです。バックエンドやAI APIは使いません。問題セットをJSONで取り込み、均等配点で採点し、問題・回答・解説・得点をMarkdownでダウンロードできます。得点履歴のCSV、復元用JSONにも対応します。

このリポジトリにはシステムとオリジナルの操作デモだけを置きます。書籍本文・PDF・個人の設問・受験履歴は含めません。

## 動かす

Node.js 24を推奨します。

```sh
npm ci
npm run prepare:data -- examples/catalog.json
npm run dev
```

`prepare:data` は16文字以上のパスワードを対話入力で受け取り、`public/vault.json` を生成します。ブラウザで同じパスワードを入力して開きます。デモの書名は「学習室の使い方」です。`examples/chapter.json` をインポートして動作を確認できます。

書籍用には、非公開のデータ領域で `{ "book": "教材名", "version": "v1", "chapters": [...] }` というカタログJSONを用意し、そのパスを `prepare:data` に渡します。`chapters` の要素は [問題セット仕様](skills/create-study-questions/references/question-set.md) の `chapter` と同じ形式です。設問のインポートは1章ずつで、書名が現在の学習室と一致している必要があります。同じ章IDは置き換わり、過去の受験結果には当時の問題が残ります。

静的配信は `npm run build` の出力 `dist/` を使います。CIの既知パスワードは公開デモのテスト専用です。個人のカタログに流用しないでください。

## 保存とパスワード

カタログとブラウザ内の学習状態はAES-256-GCMで暗号化します。鍵はパスワードからPBKDF2-SHA-256、600,000回で導出し、ランダムなsaltとIVを使います。パスワードは保存しません。解除後のデータと鍵は利用中のブラウザに存在します。

これはサーバーのログイン認証ではなく、静的な暗号化データの解除です。公開された暗号文は誰でも取得できるため、長く推測されにくいパスワードを使ってください。忘れた場合の復旧機能はありません。ブラウザのデータ削除や別端末への移行に備えてバックアップをダウンロードできます。ダウンロードしたMarkdown・CSV・JSONは平文です。

## Claude Code / Codex 用のスキル

公開リポジトリから個別にインストールできます。

```sh
npx skills add takashiAg/study-room --skill create-study-questions
npx skills add takashiAg/study-room --skill review-study-results
```

インストーラーでClaude CodeまたはCodexを選択します。設問生成スキルはPDF・EPUB・画像・読書メモを確認し、出典を区別したオリジナル問題JSONを作ります。本文がない場合は「補助問題・本文未確認」として扱います。復習スキルにはアプリから出したMarkdownを渡してください。スキルはアプリのソースに依存せず、設問仕様も同梱しています。

## 設計と検証

`src/core` に採点・検証・ユースケース、`src/adapters/inbound/react` に画面、`src/adapters/outbound/browser` に暗号化・保存・ダウンロードを置きます。`src/main.tsx` が具体実装を組み立てます。詳細は [設計](docs/architecture.md)、変更時の手順は [AGENTS.md](AGENTS.md) を参照してください。

```sh
npm run typecheck
npm run check:architecture
npm run test:unit
npm run test:ui
npm run build
npx playwright install chromium
npm run test:e2e
```

E2Eの前には公開デモをテスト用パスワードで生成します。

```sh
printf '%s\n' 'e2e-only-password-1234' | npm run prepare:data -- examples/catalog.json
npm run build
npm run test:e2e
```

CIは型・依存方向・単体テスト・UIテスト・ビルド・デスクトップとモバイルのE2Eを実行します。DependabotはReact関連をまとめて毎週確認します。自動マージや自動公開は設定していません。
