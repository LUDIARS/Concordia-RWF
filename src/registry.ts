/**
 * ワークフローレジストリ。 `ReactionWorkFlow/<name>/workflow.js` 群を集めて
 * 絵文字 → ワークフロー の解決と実行計画の取得を提供する。
 *
 * - buildRegistry: WorkflowModule[] から純粋にレジストリを組む (I/O なし・テスト容易)。
 * - loadWorkflowModulesFromDir: フォルダを走査して動的 import で集める (I/O)。
 *
 * 既定の絵文字はモジュールが持つが、 Concordia の overrides (絵文字→アクション名) が
 * 優先される (運用で写像を変えられる)。
 */

import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { isWorkflowModule, type WorkflowModule, type WorkflowContext, type WorkflowModels, type WorkflowPlan } from "./contract.js";

export interface WorkflowRegistry {
  /** name → module。 */
  byName: Map<string, WorkflowModule>;
  /** emoji → module (既定写像)。 */
  byEmoji: Map<string, WorkflowModule>;
  /** 全モジュール。 */
  list(): WorkflowModule[];
  /**
   * 絵文字を解決する。 overrides(絵文字→アクション名) が既定 emoji 写像より優先。
   * 該当無しは null。
   */
  resolve(emoji: string, overrides?: Record<string, string>): WorkflowModule | null;
  /** name から plan を得る。 無ければ null。 */
  plan(name: string, ctx: WorkflowContext, models: WorkflowModels): WorkflowPlan | null;
}

/** WorkflowModule[] から純粋にレジストリを組む。 後勝ち (同名/同絵文字は後のモジュールで上書き)。 */
export function buildRegistry(modules: WorkflowModule[]): WorkflowRegistry {
  const byName = new Map<string, WorkflowModule>();
  const byEmoji = new Map<string, WorkflowModule>();
  for (const m of modules) {
    byName.set(m.name, m);
    for (const e of m.emojis) byEmoji.set(e.trim(), m);
  }
  return {
    byName,
    byEmoji,
    list: () => [...byName.values()],
    resolve(emoji, overrides) {
      const e = emoji.trim();
      if (overrides && Object.prototype.hasOwnProperty.call(overrides, e)) {
        const name = overrides[e];
        return name ? byName.get(name) ?? null : null;
      }
      return byEmoji.get(e) ?? null;
    },
    plan(name, ctx, models) {
      const m = byName.get(name);
      return m ? m.plan(ctx, models) : null;
    },
  };
}

/** 既定のワークフロー置き場 (= このモジュールと同階層の ReactionWorkFlow/)。 */
export function defaultWorkflowsDir(): string {
  const here = fileURLToPath(new URL(".", import.meta.url));
  return join(here, "ReactionWorkFlow");
}

/**
 * `<dir>/<name>/workflow.js` 群を走査して動的 import で集める。
 * 各サブフォルダの default export (または `workflow` 名前付き) が WorkflowModule なら採用。
 * 壊れた / 契約外のものは skip し warn する (落とさない)。
 */
export async function loadWorkflowModulesFromDir(
  dir: string,
  log?: { warn: (m: string) => void },
): Promise<WorkflowModule[]> {
  if (!existsSync(dir)) return [];
  let subs: string[];
  try {
    subs = readdirSync(dir).filter((n) => {
      try {
        return statSync(join(dir, n)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
  const out: WorkflowModule[] = [];
  for (const sub of subs) {
    const entry = join(dir, sub, "workflow.js");
    if (!existsSync(entry)) continue;
    try {
      const mod = (await import(pathToFileURL(entry).href)) as { default?: unknown; workflow?: unknown };
      const candidate = mod.default ?? mod.workflow;
      if (isWorkflowModule(candidate)) {
        out.push(candidate);
      } else {
        log?.warn(`rwf-registry: ${sub}/workflow.js is not a valid WorkflowModule → skip`);
      }
    } catch (e) {
      log?.warn(`rwf-registry: import ${sub}/workflow.js failed: ${(e as Error).message}`);
    }
  }
  return out;
}
