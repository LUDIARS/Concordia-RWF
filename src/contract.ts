/**
 * ワークフローモジュール契約。
 *
 * RWF (ReactionWorkFlow) の各ワークフローは「機能名/実装名」のフォルダ構成で、
 * `ReactionWorkFlow/<name>/workflow.ts` に 1 つずつ TypeScript モジュールとして置く。
 * 各モジュールは既定トリガー絵文字と plan() を持つ。 プロンプトだけのものも plan() で
 * WorkflowPlan を返す (実装を伴うものはここにロジックを書ける)。
 *
 * 既定の絵文字はモジュールが定義するが、 Concordia 側の customMappings (絵文字→アクション)
 * で上書きできる (運用で変えられる)。
 *
 * registry がフォルダを走査してこれらを集め、 emoji→workflow を構築する。
 */

import type { WorkflowContext, WorkflowPlan, WorkflowModels } from "./reaction-workflow.js";

export type { WorkflowContext, WorkflowPlan, WorkflowModels } from "./reaction-workflow.js";

/** 1 ワークフローの定義 (= `ReactionWorkFlow/<name>/workflow.ts` の default export)。 */
export interface WorkflowModule {
  /** 一意なアクション名 (フォルダ名と一致させる)。 registry のキー。 */
  name: string;
  /** 既定トリガー絵文字 (unicode)。 Concordia の customMappings で上書き可。 */
  emojis: string[];
  /** 人間向けの短いラベル (受付通知 / GUI 表示)。 */
  label: string;
  /** 何をするか (GUI のヘルプ表示用)。 任意。 */
  summary?: string;
  /**
   * 実行計画を返す。 inject (authoring session へ割り込み) / headless (別プロセス実行) /
   * その他を ctx に応じて決める。 プロンプトだけのワークフローもここで plan を返す。
   */
  plan(ctx: WorkflowContext, models: WorkflowModels): WorkflowPlan;
}

/** 値が WorkflowModule の最低限の形を満たすか (動的 import の実行時検証)。 */
export function isWorkflowModule(v: unknown): v is WorkflowModule {
  const o = v as Partial<WorkflowModule> | null;
  return (
    !!o &&
    typeof o.name === "string" &&
    o.name.length > 0 &&
    Array.isArray(o.emojis) &&
    o.emojis.every((e) => typeof e === "string") &&
    typeof o.label === "string" &&
    typeof o.plan === "function"
  );
}
