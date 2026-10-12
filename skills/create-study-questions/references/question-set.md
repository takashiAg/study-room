# Study Room question set / format 1

インポート単位は1章のJSONオブジェクト。複数章を作る場合はファイルを分ける。インポート先のカタログと `book` を完全一致させる。同じ章IDは置き換わるため、版を更新して意図した章を指定する。JSON全体は2,000,000文字以下に収める。採点は各問均等配点で `round(正答数 / 問題数 * 100)`。自由記述の自動採点はない。

| フィールド | 仕様 |
| --- | --- |
| `format` | 数値 `1` |
| `book` | 書名または教材名、1〜200文字 |
| `version` | 問題セットの版、1〜100文字。設問や正解を変更したら更新 |
| `chapter.id` | 整数 1〜999 |
| `chapter.title` | 1〜200文字 |
| `chapter.description` | 学習範囲、1〜1000文字 |
| `chapter.kind` | `book` / `notes` / `supplemental` |
| `chapter.source` | 根拠・版・確認範囲、1〜2000文字 |
| `chapter.questions` | 1〜50問 |
| `questions[].id` | 章内で一意、1〜100文字 |
| `questions[].topic` | 学習テーマ、1〜200文字 |
| `questions[].section` | 参照位置または本文未確認の表示、1〜1000文字 |
| `questions[].prompt` | 問題文、1〜10000文字 |
| `questions[].options` | 異なる文字列を2〜6個、各1〜3000文字 |
| `questions[].answer` | 正解の配列インデックス。0始まりの整数 |
| `questions[].explanation` | 理由と補足、1〜10000文字 |

文字列は空白だけにしない。文字数はJavaScriptの文字列長（UTF-16）で数える。HTMLや実行コードを埋め込まず平文にする。以下は書籍に依存しない補助問題の例。

```json
{
  "format": 1,
  "book": "設計の補助教材",
  "version": "2026-10-12-v1",
  "chapter": {
    "id": 1,
    "title": "依存関係の方向",
    "description": "外部の仕組みとアプリケーションの判断を分離する考え方を確認します。",
    "kind": "supplemental",
    "source": "一般的なヘキサゴナルアーキテクチャの考え方によるオリジナル補助問題。書籍本文は未確認。",
    "questions": [
      {
        "id": "boundary-1",
        "topic": "依存関係",
        "section": "補助問題・本文未確認",
        "prompt": "保存先をブラウザから別のストレージへ変更しても採点ルールを変更せずに済ませたい。どの構成がこの目的に適しているか？",
        "options": [
          "採点処理がブラウザのlocalStorageを直接呼び出す",
          "保存用のポートを定義し、ストレージへの処理をアダプターに実装する"
        ],
        "answer": 1,
        "explanation": "ポートを介して保存すれば採点ルールは具体的なストレージAPIに依存せず、外側の実装を交換できる。一方、小さな使い捨てのアプリでは抽象化の維持コストが利益を上回ることもある。"
      }
    ]
  }
}
```
