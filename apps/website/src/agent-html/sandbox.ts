/**
 * The capability list for every frame that renders agent-authored HTML.
 *
 * What matters is what is ABSENT: without `allow-same-origin` the frame gets
 * an opaque origin, so the document cannot reach the app origin's cookies,
 * storage, or DOM. That omission is the entire boundary between "an agent
 * wrote some HTML" and "an agent can read your session". Never add it.
 *
 * One constant, imported by all three surfaces, so the warning travels with
 * the value instead of sitting next to one of three copies.
 */
export const agentHtmlSandbox =
    'allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts';
