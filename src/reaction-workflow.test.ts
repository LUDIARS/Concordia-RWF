import { describe, it, expect } from "vitest";
import {
  classifyReactionWorkflow,
  defaultReactionEmojiMap,
  isWorkflowAction,
  planWorkflow,
  reactionAckText,
  ReactionWorkflowRunner,
  WORKFLOW_ACTIONS,
  WORKFLOW_ACTION_HELP,
  type ReactionWorkflowInput,
  type WorkflowAction,
  type WorkflowContext,
} from "./reaction-workflow.js";

const baseCtx: WorkflowContext = {
  messageText: "新しいキャッシュ層を入れる提案。LRU で 1000 件、TTL 5 分。",
  authorLabel: "設計担当",
  repoPath: "E:/Document/Ars/Memoria",
  sessionActive: true,
  memoriaPath: "E:/Document/Ars/Memoria",
  reactorId: "u123",
};

describe("classifyReactionWorkflow", () => {
  it.each([
    ["👍", "start-impl"],
    ["🆗", "start-impl"],
    ["🙏", "enumerate-remaining"],
    ["🫶", "memoria-remaining"],
    ["😴", "memoria-remaining"],
    ["✨", "memoria-remaining"],
    ["📲", "status-check"],
    ["🆙", "status-check"],
    ["👆", "status-check"],
    ["😄", "repo-memory-good"],
    ["😀", "repo-memory-good"],
    ["👀", "memoria-note"],
    ["👈", "memoria-note"],
    ["📓", "memoria-note"],
    ["✏️", "memoria-note"],
    ["📝", "memoria-task"],
    ["✅", "memoria-task"],
    ["✔️", "memoria-task"],
    ["😡", "repo-memory-bad"],
    ["👎", "repo-memory-bad"],
    ["⏭️", "defer-impl"],
    ["📤", "defer-impl"],
    ["🗂️", "defer-impl"],
    ["🙄", "force-enter"],
    ["🤝", "delegate-task"],
    ["🫱", "delegate-task"],
    ["👌", "handoff-document"],
    ["👋", "handoff-document"],
    ["▶️", "resume-work"],
    ["⏩", "resume-work"],
    ["🔀", "merge-pr"],
    ["🚀", "merge-pr"],
  ] as const)("maps %s → %s", (emoji, action) => {
    expect(classifyReactionWorkflow(emoji)).toBe(action);
  });

  it("returns null for unmapped emoji", () => {
    expect(classifyReactionWorkflow("🎉")).toBeNull();
    expect(classifyReactionWorkflow("🍕")).toBeNull();
  });

  it("ignores surrounding whitespace", () => {
    expect(classifyReactionWorkflow(" 👍 ")).toBe("start-impl");
  });

  it("custom overrides take precedence over defaults; add new emoji", () => {
    const overrides = { "👍": "memoria-note" as const, "🔥": "start-impl" as const };
    expect(classifyReactionWorkflow("👍", overrides)).toBe("memoria-note"); // 上書き
    expect(classifyReactionWorkflow("🔥", overrides)).toBe("start-impl");   // 新規
    expect(classifyReactionWorkflow("🫶", overrides)).toBe("memoria-remaining"); // 上書きなし=既定
    expect(classifyReactionWorkflow("🎉", overrides)).toBeNull();
  });
});

describe("defaultReactionEmojiMap / isWorkflowAction", () => {
  it("flattens defaults and every value is a valid action", () => {
    const map = defaultReactionEmojiMap();
    expect(map["🙏"]).toBe("enumerate-remaining");
    expect(map["🫶"]).toBe("memoria-remaining");
    expect(map["📲"]).toBe("status-check");
    for (const action of Object.values(map)) expect(isWorkflowAction(action)).toBe(true);
  });

  it("isWorkflowAction rejects unknown strings", () => {
    expect(isWorkflowAction("start-impl")).toBe(true);
    expect(isWorkflowAction("nope")).toBe(false);
    expect(isWorkflowAction(123)).toBe(false);
  });
});

describe("WORKFLOW_ACTION_HELP", () => {
  it("has label/summary/mode for every action", () => {
    for (const a of WORKFLOW_ACTIONS) {
      const h = WORKFLOW_ACTION_HELP[a];
      expect(h.label.length).toBeGreaterThan(0);
      expect(h.summary.length).toBeGreaterThan(0);
      expect(h.mode.length).toBeGreaterThan(0);
    }
  });
});

describe("planWorkflow", () => {
  it("start-impl on active session → inject (no headless)", () => {
    const plan = planWorkflow("start-impl", { ...baseCtx, sessionActive: true });
    expect(plan.mode).toBe("inject");
    expect(plan.prompt).toContain("実装");
  });

  it("start-impl on inactive session → headless in repo cwd", () => {
    const plan = planWorkflow("start-impl", { ...baseCtx, sessionActive: false });
    expect(plan.mode).toBe("headless");
    expect(plan.cwd).toBe(baseCtx.repoPath);
  });

  it("handoff-document on active session → inject, 引継ぎ資料を session-logs へ", () => {
    const plan = planWorkflow("handoff-document", { ...baseCtx, sessionActive: true });
    expect(plan.mode).toBe("inject");
    expect(plan.prompt).toContain("引継ぎ資料");
    expect(plan.prompt).toContain("session-logs");
    expect(plan.prompt).toContain("残作業");
  });

  it("handoff-document on inactive session → headless sonnet in repo cwd", () => {
    const plan = planWorkflow("handoff-document", { ...baseCtx, sessionActive: false });
    expect(plan.mode).toBe("headless");
    expect(plan.model).toBe("sonnet");
    expect(plan.cwd).toBe(baseCtx.repoPath);
  });

  it("repo-memory-good → headless haiku in repo cwd, embeds message", () => {
    const plan = planWorkflow("repo-memory-good", baseCtx);
    expect(plan.mode).toBe("headless");
    expect(plan.model).toBe("haiku");
    expect(plan.cwd).toBe(baseCtx.repoPath);
    expect(plan.prompt).toContain("作業メモリ");
    expect(plan.prompt).toContain("キャッシュ層");
  });

  it("repo-memory-bad on active session → inject (作業中断 + 反省、 記録せず)", () => {
    const plan = planWorkflow("repo-memory-bad", baseCtx);
    expect(plan.mode).toBe("inject");
    expect(plan.prompt).toContain("良くない");
    expect(plan.prompt).toContain("中断");
    expect(plan.prompt).toContain("記録しない");
  });

  it("repo-memory-bad on inactive session → headless haiku (反省のみ)", () => {
    const plan = planWorkflow("repo-memory-bad", { ...baseCtx, sessionActive: false });
    expect(plan.mode).toBe("headless");
    expect(plan.model).toBe("haiku");
    expect(plan.cwd).toBe(baseCtx.repoPath);
    expect(plan.prompt).toContain("良くない");
  });

  it("memoria-note → headless haiku in Memoria cwd", () => {
    const plan = planWorkflow("memoria-note", baseCtx);
    expect(plan.mode).toBe("headless");
    expect(plan.model).toBe("haiku");
    expect(plan.cwd).toBe(baseCtx.memoriaPath);
    expect(plan.prompt).toContain("Memoria");
  });

  it("memoria-task → headless sonnet in Memoria cwd", () => {
    const plan = planWorkflow("memoria-task", baseCtx);
    expect(plan.mode).toBe("headless");
    expect(plan.model).toBe("sonnet");
    expect(plan.cwd).toBe(baseCtx.memoriaPath);
    expect(plan.prompt).toContain("タスク");
  });

  it("enumerate-remaining on active session → inject (残作業洗い出し)", () => {
    const plan = planWorkflow("enumerate-remaining", { ...baseCtx, sessionActive: true });
    expect(plan.mode).toBe("inject");
    expect(plan.prompt).toContain("残作業");
  });

  it("enumerate-remaining on inactive session → headless sonnet in repo cwd", () => {
    const plan = planWorkflow("enumerate-remaining", { ...baseCtx, sessionActive: false });
    expect(plan.mode).toBe("headless");
    expect(plan.model).toBe("sonnet");
    expect(plan.cwd).toBe(baseCtx.repoPath);
  });

  it("memoria-remaining → headless sonnet in Memoria cwd (残作業記録)", () => {
    const plan = planWorkflow("memoria-remaining", baseCtx);
    expect(plan.mode).toBe("headless");
    expect(plan.model).toBe("sonnet");
    expect(plan.cwd).toBe(baseCtx.memoriaPath);
    expect(plan.prompt).toContain("残作業");
    expect(plan.prompt).toContain("Memoria");
  });

  it("status-check on active session → inject (状況報告)", () => {
    const plan = planWorkflow("status-check", { ...baseCtx, sessionActive: true });
    expect(plan.mode).toBe("inject");
    expect(plan.prompt).toContain("状況");
  });

  it("status-check on inactive session → headless sonnet in repo cwd", () => {
    const plan = planWorkflow("status-check", { ...baseCtx, sessionActive: false });
    expect(plan.mode).toBe("headless");
    expect(plan.cwd).toBe(baseCtx.repoPath);
  });

  it("inject prompts embed the converted posted message (投稿内容を変換して渡す)", () => {
    for (const action of ["start-impl", "enumerate-remaining", "status-check"] as const) {
      const plan = planWorkflow(action, { ...baseCtx, sessionActive: true });
      expect(plan.mode).toBe("inject");
      expect(plan.prompt).toContain("対象メッセージ");
      expect(plan.prompt).toContain("キャッシュ層"); // baseCtx.messageText の一部
    }
  });

  it("honors custom model overrides", () => {
    const plan = planWorkflow("memoria-task", baseCtx, { haiku: "h", sonnet: "claude-sonnet-4-6" });
    expect(plan.model).toBe("claude-sonnet-4-6");
  });

  it("defer-impl → headless sonnet in Memoria cwd, 別セッション対応 を含む", () => {
    const plan = planWorkflow("defer-impl", { ...baseCtx, messageText: "認証トークン更新機能を実装しよう。Memoriaに詳細を記録してください。別セッションで対応します。" });
    expect(plan.mode).toBe("headless");
    expect(plan.model).toBe("sonnet");
    expect(plan.cwd).toBe(baseCtx.memoriaPath);
    expect(plan.prompt).toContain("別セッション");
    expect(plan.prompt).toContain("実装タスク");
    expect(plan.prompt).toContain("認証トークン");
  });

  it("force-enter → inject CR (session に関係なく)", () => {
    const planActive = planWorkflow("force-enter", { ...baseCtx, sessionActive: true });
    expect(planActive.mode).toBe("inject");
    expect(planActive.prompt).toBe("\r");
    const planInactive = planWorkflow("force-enter", { ...baseCtx, sessionActive: false });
    expect(planInactive.mode).toBe("inject");
    expect(planInactive.prompt).toBe("\r");
  });

  it("delegate-task on active session → inject (タスク判定 + 委託 + 監視)", () => {
    const plan = planWorkflow("delegate-task", { ...baseCtx, sessionActive: true });
    expect(plan.mode).toBe("inject");
    expect(plan.prompt).toContain("タスク判定");
    expect(plan.prompt).toContain("delegation/templates");
    expect(plan.prompt).toContain("監視");
    expect(plan.prompt).toContain("対象メッセージ");
    expect(plan.prompt).toContain("キャッシュ層"); // baseCtx.messageText の一部
  });

  it("delegate-task on inactive session → headless haiku in repoPath cwd", () => {
    const plan = planWorkflow("delegate-task", { ...baseCtx, sessionActive: false });
    expect(plan.mode).toBe("headless");
    expect(plan.model).toBe("haiku");
    expect(plan.cwd).toBe(baseCtx.repoPath);
    expect(plan.prompt).toContain("タスク判定");
    expect(plan.prompt).toContain("監視は行わない");
  });

  it("resume-work on active session → inject (中断した作業の続き)", () => {
    const plan = planWorkflow("resume-work", { ...baseCtx, sessionActive: true });
    expect(plan.mode).toBe("inject");
    expect(plan.prompt).toContain("続き");
    expect(plan.prompt).toContain("対象メッセージ");
  });

  it("resume-work on inactive session → headless sonnet in repo cwd, session-logs から復元", () => {
    const plan = planWorkflow("resume-work", { ...baseCtx, sessionActive: false });
    expect(plan.mode).toBe("headless");
    expect(plan.model).toBe("sonnet");
    expect(plan.cwd).toBe(baseCtx.repoPath);
    expect(plan.prompt).toContain("session-logs");
    expect(plan.prompt).toContain("git status");
  });

  it("merge-pr on active session → inject (open PR を squash merge)", () => {
    const plan = planWorkflow("merge-pr", { ...baseCtx, sessionActive: true });
    expect(plan.mode).toBe("inject");
    expect(plan.prompt).toContain("マージ");
    expect(plan.prompt).toContain("--squash");
    expect(plan.prompt).toContain("gh pr checks");
  });

  it("merge-pr on inactive session → headless sonnet in repo cwd", () => {
    const plan = planWorkflow("merge-pr", { ...baseCtx, sessionActive: false });
    expect(plan.mode).toBe("headless");
    expect(plan.model).toBe("sonnet");
    expect(plan.cwd).toBe(baseCtx.repoPath);
    expect(plan.prompt).toContain("gh pr merge");
  });
});

describe("ReactionWorkflowRunner.handle (platform-input / map 非依存)", () => {
  function makeRunner(over: Record<string, unknown> = {}) {
    const calls: { prompt: string; opts?: { cwd?: string; model?: string } }[] = [];
    const injects: { sessionId: string; text: string; source: string }[] = [];
    const runHeadless = async (prompt: string, opts?: { cwd?: string; model?: string }) => {
      calls.push({ prompt, opts });
      return { ok: true, exit_code: 0, stdout: "", stderr: "", duration_ms: 1 };
    };
    const runner = new ReactionWorkflowRunner({
      runHeadless,
      emitInject: (sessionId: string, text: string, source: string) => injects.push({ sessionId, text, source }),
      workspaceRoot: "E:/Document/Ars",
      memoriaPath: "E:/Document/Ars/Memoria",
      enabled: true,
      log: { info: () => {}, warn: () => {} },
      now: () => 1_000_000,
      ...over,
    });
    return { runner, calls, injects };
  }

  const baseInput: ReactionWorkflowInput = {
    dedupeKey: "m1",
    emoji: "👀",
    userId: "u1",
    messageText: "これメモして",
    authorLabel: "設計担当",
    repoPath: "E:/Document/Ars/KuzuSurvivors",
    sessionActive: false,
    sessionId: null,
  };

  it("memoria-note(👀) は headless で memoriaPath を cwd に走り、本文を渡す", async () => {
    const { runner, calls } = makeRunner();
    await runner.handle({ ...baseInput, emoji: "👀" });
    expect(calls).toHaveLength(1);
    expect(calls[0].opts?.cwd).toBe("E:/Document/Ars/Memoria");
    expect(calls[0].prompt).toContain("これメモして");
  });

  it("残作業系(🙏)は本文が空でも発火する (headless / repoPath を cwd に)", async () => {
    const { runner, calls } = makeRunner();
    await runner.handle({ ...baseInput, emoji: "🙏", messageText: "" });
    expect(calls).toHaveLength(1);
    expect(calls[0].opts?.cwd).toBe("E:/Document/Ars/KuzuSurvivors");
  });

  it("無効 (enabled=false) なら何もしない", async () => {
    const { runner, calls } = makeRunner({ enabled: false });
    await runner.handle({ ...baseInput });
    expect(calls).toHaveLength(0);
  });

  it("同一 dedupeKey+emoji+userId は cooldown 内で1回だけ発火", async () => {
    const { runner, calls } = makeRunner();
    await runner.handle({ ...baseInput });
    await runner.handle({ ...baseInput });
    expect(calls).toHaveLength(1);
  });

  it("ワークフロー対象外の絵文字は無処理", async () => {
    const { runner, calls } = makeRunner();
    await runner.handle({ ...baseInput, emoji: "🍕" });
    expect(calls).toHaveLength(0);
  });

  it("発火確定時に onAccept が action 付きで1回だけ呼ばれる", async () => {
    const { runner } = makeRunner();
    const accepted: WorkflowAction[] = [];
    await runner.handle({ ...baseInput, emoji: "🙏", messageText: "" }, (a) => accepted.push(a));
    expect(accepted).toEqual(["enumerate-remaining"]);
  });

  it("無効 / 対象外 / dedup-skip では onAccept は呼ばれない", async () => {
    const accepted: WorkflowAction[] = [];
    const onAccept = (a: WorkflowAction) => accepted.push(a);

    const disabled = makeRunner({ enabled: false });
    await disabled.runner.handle({ ...baseInput }, onAccept);
    expect(accepted).toHaveLength(0); // enabled=false

    const unmapped = makeRunner();
    await unmapped.runner.handle({ ...baseInput, emoji: "🍕" }, onAccept);
    expect(accepted).toHaveLength(0); // 写像外

    const dup = makeRunner();
    await dup.runner.handle({ ...baseInput }, onAccept);
    await dup.runner.handle({ ...baseInput }, onAccept);
    expect(accepted).toHaveLength(1); // 2回目は cooldown でスキップ
  });

  it("delegate-task(🤝) inactive → headless haiku / repoPath cwd / タスク判定含む", async () => {
    const { runner, calls } = makeRunner();
    await runner.handle({ ...baseInput, emoji: "🤝", sessionActive: false });
    expect(calls).toHaveLength(1);
    expect(calls[0].opts?.cwd).toBe("E:/Document/Ars/KuzuSurvivors");
    expect(calls[0].prompt).toContain("タスク判定");
    expect(calls[0].prompt).toContain("これメモして");
  });

  it("delegate-task(🤝) active → inject (runHeadless 非呼び出し)", async () => {
    const { runner, calls } = makeRunner();
    await runner.handle({ ...baseInput, emoji: "🤝", sessionActive: true, sessionId: "sess-abc" });
    expect(calls).toHaveLength(0); // inject 経路なので headless は起動しない
  });

  it("delegate-task の onAccept は action='delegate-task' で呼ばれる", async () => {
    const { runner } = makeRunner();
    const accepted: WorkflowAction[] = [];
    await runner.handle({ ...baseInput, emoji: "🤝", sessionActive: false }, (a) => accepted.push(a));
    expect(accepted).toEqual(["delegate-task"]);
  });

  it("reactionAckText は 絵文字 + ラベル + 受付文 を返す", () => {
    expect(reactionAckText("enumerate-remaining", "🙏")).toBe("🙏 残作業の洗い出しを受け付けました");
  });
});
