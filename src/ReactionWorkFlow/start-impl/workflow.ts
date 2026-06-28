/**
 * start-impl (👍 / 🆗) — このメッセージ (直前の提案 / 計画) を承認し、 そのまま実装着手させる。
 * authoring session が active なら inject、 止まっていれば headless で repo を開いて着手。
 *
 * ReactionWorkFlow の per-workflow モジュールの代表例 (条件分岐を持つ実装)。
 */

import type { WorkflowModule, WorkflowContext, WorkflowModels, WorkflowPlan } from "../../contract.js";
import { buildHead, buildMsgRef } from "../../prelude.js";

const NAME = "start-impl" as const;

const startImpl: WorkflowModule = {
  name: NAME,
  emojis: ["👍", "🆗"],
  label: "実装着手",
  summary: "投稿内容 (直前の提案 / 計画) を『そのまま実装に着手せよ』という指示に変換して渡す。",
  plan(ctx: WorkflowContext, _models: WorkflowModels): WorkflowPlan {
    const prompt =
      `👍 このメッセージ (直前の提案 / 計画) が承認されました。 提案内容を**そのまま実装に着手**してください。\n` +
      `- 余計な再確認はせず、 提案された方針で実装を開始する。\n` +
      `- LUDIARS 規約 (ブランチ → 実装 → コミット → PR、 自動マージ可) に従う。\n` +
      `- 提案に曖昧な点があっても、 最も素直な解釈で進めてよい。\n` +
      `- ただし対象が直前の「反省」(😡/👎 由来) なら、 この 👍 は実装着手ではなく ` +
      `「その反省を“避けるべきパターン”として当該リポの作業メモリに記録せよ」という承認である。`;
    // authoring session が生きていれば、 その AI に inject して文脈ごと続行させる。
    if (ctx.sessionActive) {
      return { action: NAME, mode: "inject", prompt: prompt + buildMsgRef(ctx) };
    }
    // 非 active: headless で repo を開いて着手する。
    return {
      action: NAME,
      mode: "headless",
      cwd: ctx.repoPath ?? undefined,
      prompt: buildHead(ctx) + "\n" + prompt,
    };
  },
};

export default startImpl;
