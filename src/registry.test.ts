import { describe, it, expect } from "vitest";
import { buildRegistry } from "./registry.js";
import { isWorkflowModule, type WorkflowModule, type WorkflowContext } from "./contract.js";
import startImpl from "./ReactionWorkFlow/start-impl/workflow.js";

const ctx: WorkflowContext = {
  messageText: "この設計で実装して",
  authorLabel: "設計担当",
  repoPath: "E:/Document/Ars/KuzuSurvivors",
  sessionActive: false,
  memoriaPath: "E:/Document/Ars/Memoria",
  reactorId: "u1",
};
const models = { haiku: "haiku", sonnet: "sonnet" };

describe("start-impl workflow module", () => {
  it("契約を満たす (name/emojis/label/plan)", () => {
    expect(isWorkflowModule(startImpl)).toBe(true);
    expect(startImpl.name).toBe("start-impl");
    expect(startImpl.emojis).toContain("👍");
  });
  it("非active は headless で repoPath を cwd に着手指示を返す", () => {
    const plan = startImpl.plan(ctx, models);
    expect(plan.mode).toBe("headless");
    expect(plan.cwd).toBe("E:/Document/Ars/KuzuSurvivors");
    expect(plan.prompt).toContain("実装に着手");
  });
  it("active は inject + 対象メッセージ参照を付ける", () => {
    const plan = startImpl.plan({ ...ctx, sessionActive: true }, models);
    expect(plan.mode).toBe("inject");
    expect(plan.prompt).toContain("対象メッセージ");
  });
});

describe("buildRegistry", () => {
  it("name/emoji で解決し plan を取れる", () => {
    const reg = buildRegistry([startImpl]);
    expect(reg.resolve("👍")?.name).toBe("start-impl");
    expect(reg.resolve("🆗")?.name).toBe("start-impl");
    expect(reg.resolve("❓")).toBeNull();
    const plan = reg.plan("start-impl", ctx, models);
    expect(plan?.mode).toBe("headless");
  });
  it("overrides(絵文字→名前) が既定写像より優先", () => {
    const reg = buildRegistry([startImpl]);
    // 👍 を別アクションへ向ける上書き。 該当 module 無しなら null。
    expect(reg.resolve("👍", { "👍": "no-such" })).toBeNull();
    // 既定では start-impl でない絵文字を start-impl に向ける。
    expect(reg.resolve("🔥", { "🔥": "start-impl" })?.name).toBe("start-impl");
  });
  it("list は登録モジュールを返す", () => {
    expect(buildRegistry([startImpl]).list().map((m) => m.name)).toEqual(["start-impl"]);
  });
});
