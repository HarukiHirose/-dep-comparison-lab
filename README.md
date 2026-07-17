# 依存関係比較実験: Legacy vs Zero-Dependency ToDoアプリ

## 目的

生成AIを用いた「外部ライブラリ機能のゼロディペンデンシー再実装」が、長期運用において
従来型の外部ライブラリ依存構成と比べてどのような違いを生むかを、実際に2つの等価な
Webアプリを継続運用しながら定量的に観測する。

## 構成

```
dep-comparison-project/
├── legacy-todo-app/       # 従来型: Express + bcrypt + jsonwebtoken + zod + better-sqlite3
├── zero-dep-todo-app/     # ゼロディペンデンシー版: Node.js組み込みAPIのみで同機能を再実装
├── metrics/               # 両アプリから指標を収集するスクリプトと蓄積データ
├── dashboard/             # 収集した指標を時系列で可視化するWebアプリ
└── .github/workflows/     # 定期(毎日)自動収集 + 記録コミット
```

両アプリは**機能的に同一**(ユーザー登録/ログイン(JWT風トークン)/タスクCRUD/入力バリデーション)
であることが比較の前提条件。エンドポイント仕様は `API-SPEC.md` を参照(両アプリ共通)。

## 置き換えマッピング

| 機能 | legacy-todo-app | zero-dep-todo-app |
|---|---|---|
| HTTPサーバー/ルーティング | express | `node:http` + 自作ルーター |
| パスワードハッシュ | bcrypt | `node:crypto` (scrypt) |
| 認証トークン | jsonwebtoken | `node:crypto` (HMAC-SHA256による自作署名トークン) |
| 入力バリデーション | zod | 自作バリデーション関数群 |
| DB / 永続化 | better-sqlite3 | `node:sqlite` (Node組み込み, フォールバックにJSONファイルストア) |
| CORS | cors | 自作ミドルウェア(数行) |
| 環境変数読み込み | dotenv | `node:process.loadEnvFile`(Node 20.6+組み込み) |

## 収集する指標(長期運用で記録)

1. **脆弱性(CVE)関連**: `npm audit` の critical/high/moderate/low 件数、初出から対応までの日数
2. **破壊的変更への追従コスト**: 依存のメジャーバージョン更新有無、更新にかかった変更行数
3. **ビルド/パフォーマンス**: `tsc` ビルド時間、`node_modules` サイズ、簡易バンドルサイズ、起動時間
4. **コード量/保守性**: LOC、依存パッケージ数(直接+推移的)、AI再実装部分の挙動差異(将来的にE2Eテストで検証)

## 使い方

### 1. 両アプリのセットアップ

```bash
cd legacy-todo-app && npm install
cd ../zero-dep-todo-app && npm install   # 依存ゼロなので実質何もインストールされない
```

### 2. 指標の収集(手動実行)

```bash
node metrics/collect.mjs
```

`metrics/history.jsonl` に1行1レコードで追記される。

### 3. 自動収集(推奨: 長期観測のため)

`.github/workflows/collect-metrics.yml` が毎日UTC 0時に起動し、
`metrics/collect.mjs` を実行して結果を `metrics/history.jsonl` にコミットする。
そのままGitHubリポジトリにpushしてActionsを有効化すれば、放置するだけで
データが蓄積されていく。

### 4. ダッシュボードで確認

`dashboard/index.html` をブラウザで開く(またはGitHub Pagesで公開)と、
`metrics/history.jsonl` を読み込んで時系列グラフを表示する。

## 注意事項

- `node:sqlite` はNode 22.5+の組み込みモジュール(バージョンによっては
  `--experimental-sqlite` フラグが必要)。使用できない環境では自動的に
  JSONファイルストアにフォールバックする(`zero-dep-todo-app/src/db.ts` 参照)。
- この実験はあくまで実装済みの2アプリを長期間"生かしておく"ことで、
  時間経過とともに現れる差分(脆弱性の発生、エコシステムの変化への追従負荷など)
  を観測するのが目的。短期間では有意な差は出にくい点に留意。
