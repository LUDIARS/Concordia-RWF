/**
 * Concordia-RWF — Reaction-WorkFlow プラグイン (ユーザカスタマイズコード)。
 *
 * Concordia コア (本体コード) から切り出した「絵文字リアクション → アクション」エンジン。
 * Concordia 内部 (events / claude-runner / enter-key) に一切依存せず、 すべて DI で受ける
 * (ReactionWorkflowDeps)。 Concordia はこのパッケージを **ランタイム動的 import** で読み込み、
 * 契約 (ReactionWorkflowRunner + classify 系) 越しに利用する。
 *
 * これがプラグインの公開契約 (entry point)。 Concordia コアが参照する公開シンボルをここから
 * 再エクスポートする。
 */
export * from "./reaction-workflow.js";
