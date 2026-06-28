/**
 * LLM 呼び出し Vestigium ロガー (Concordia-RWF)。
 *
 * RWF は Concordia プロセス内で動くが、リアクションワークフローの LLM 呼び出しは
 * Concordia の実セッションログとは別に追いたい (ユーザ指示)。service='concordia-rwf' /
 * channel='llm' の JSONL を独立サービスとして書く。失敗は無視 (本体を落とさない)。
 * VESTIGIUM_LOGS_DIR (Excubitor が注入) または cwd/logs に出力。
 * spec 正本: LUDIARS/Vestigium/DESIGN.md §2.2
 */

import fs from "node:fs";
import path from "node:path";

const SERVICE_CODE = "concordia-rwf";

function logsRoot(): string {
  return process.env.VESTIGIUM_LOGS_DIR ?? path.join(process.cwd(), "logs");
}

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

let _stream: fs.WriteStream | null = null;
let _streamYmd = "";

function getStream(): fs.WriteStream {
  const now = new Date();
  const ymd = ymdUtc(now);
  if (_stream && _streamYmd === ymd) return _stream;
  try {
    _stream?.end();
  } catch {
    /* noop */
  }
  const dir = path.join(logsRoot(), SERVICE_CODE);
  fs.mkdirSync(dir, { recursive: true });
  _stream = fs.createWriteStream(path.join(dir, `${ymd}.jsonl`), { flags: "a", encoding: "utf8" });
  _streamYmd = ymd;
  return _stream;
}

export interface LlmLogArgs {
  backend: string;
  model: string;
  kind?: string;
  prompt: string;
  duration_ms?: number;
  ok: boolean;
  error?: string;
}

export function logLlm(args: LlmLogArgs): void {
  try {
    const ctx: Record<string, unknown> = {
      backend: args.backend,
      model: args.model,
      prompt_chars: args.prompt.length,
      prompt: args.prompt,
      ok: args.ok,
    };
    if (args.kind !== undefined) ctx.kind = args.kind;
    if (args.duration_ms !== undefined) ctx.duration_ms = args.duration_ms;
    if (args.error !== undefined) ctx.error = args.error;

    const rec =
      JSON.stringify({
        ts: Date.now(),
        level: args.ok ? "info" : "warn",
        service: SERVICE_CODE,
        channel: "llm",
        msg: `[llm] ${args.backend} ${args.model}`,
        pid: process.pid,
        ctx,
      }) + "\n";
    getStream().write(rec);
  } catch {
    // failure-safe
  }
}
