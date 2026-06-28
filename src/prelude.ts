/**
 * ワークフローモジュール共通のプロンプト素材 (DRY)。
 * 各 `ReactionWorkFlow/<name>/workflow.ts` の plan() から使う。
 * reaction-workflow.ts の planWorkflow 内ヘルパと同じ意味論。
 */

import type { WorkflowContext } from "./contract.js";

/** 長文を切り詰める (既定 4000 字)。 */
export function clip(s: string, n = 4000): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n)}…(truncated)` : t;
}

/** headless プロンプトの前置き (1 ショット自動エージェント宣言 + 対象メッセージ)。 */
export function buildHead(ctx: WorkflowContext): string {
  const msg = clip(ctx.messageText);
  return (
    `# リアクションワークフロー\n` +
    `あなたは Concordia から起動された 1 ショットの自動エージェントです。 以下の作業を完了したら終了してください。 余計な対話・確認はしません。\n\n` +
    `- 対象メッセージ投稿者: ${ctx.authorLabel}\n` +
    `- 対象メッセージ本文:\n"""\n${msg}\n"""\n`
  );
}

/** inject プロンプト末尾に付ける「どの発言への指示か」明示ブロック。 */
export function buildMsgRef(ctx: WorkflowContext): string {
  const msg = clip(ctx.messageText);
  return `\n\n--- 対象メッセージ (${ctx.authorLabel}) ---\n"""\n${msg}\n"""`;
}
