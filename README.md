# Concordia-RWF

Concordia の **Reaction-WorkFlow (RWF)** プラグイン。絵文字リアクションを「指示」として
解釈し、種類に応じて headless claude 実行 / セッション inject を行うエンジン。

**ユーザカスタマイズコード**として Concordia 本体（コアコード）から切り出している。
Concordia コアはこのパッケージを **ランタイム動的 import** で読み込み、契約越しに利用する。
本リポジトリは独立した CI（typecheck / test / build）を持つ。

## 設計
- Concordia 内部（`events` / `claude-runner` / `enter-key`）に一切依存しない自己完結エンジン。
  inject・headless 実行・enabled・モデル・カスタム写像はすべて `ReactionWorkflowDeps` で注入する。
- 公開契約（entry point）は `src/index.ts`（`ReactionWorkflowRunner` + `classifyReactionWorkflow`
  / `isStandaloneEmoji` / `reactionAckText` / 型 など）。

## 絵文字 → アクション（既定写像の例）
| 絵文字 | アクション | 概要 |
|---|---|---|
| 👍 / 🆗 | start-impl | 提案をそのまま実装着手 |
| 🙏 | enumerate-remaining | 残作業を洗い出して報告 |
| 🫶 / 😴 / ✨ | memoria-remaining | 洗い出し結果を Memoria に登録 |
| 📝 / ✅ | memoria-task | 残作業を Memoria タスク登録 |
| 🎯 | run-goal-tasks | 当月目標タスクを実行 |
| 🛠️ | add-as-workflow | カスタムワークフロー登録 |

（全アクションは `WORKFLOW_ACTION_HELP` を参照。`add-as-workflow` で (絵文字, プロンプト) を
JSON に登録すれば、組み込み写像に無い絵文字も自前ワークフローとして発火できる。）

## 開発
```sh
npm install
npm run lint   # tsc --noEmit
npm test       # vitest run
npm run build  # tsc → dist/
```

## カスタマイズ
- 既定の絵文字写像・プロンプトは `src/reaction-workflow.ts` の `WORKFLOW_EMOJI` /
  `planWorkflow` を編集する。
- 写像の上書きは Concordia 側の設定（`customMappings`）、ランタイム追加は `add-as-workflow`
  （`custom-reaction-workflows.json`）でも可能。
