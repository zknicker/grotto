#!/usr/bin/env node
// Regenerates the managed Browser skill from the installed agent-browser
// package. The sync is mechanical: it keeps upstream snapshot, reference,
// navigation, interaction, screenshot, and troubleshooting guidance verbatim,
// and changes only the Grotto invocation surface (one `browser` tool) while
// removing install, MCP, session-management, and shell-only guidance that the
// Grotto Computer owns. Any upstream drift in the touched anchors fails the
// sync so skill updates stay deliberate.
//
// Usage: node scripts/sync-browser-skill.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = path.join(repoRoot, 'apps', 'runtime', 'node_modules', 'agent-browser');
const outputPath = path.join(
    repoRoot,
    'apps',
    'runtime',
    'src',
    'plugins',
    'browser',
    'browser-skill.generated.ts'
);

// Sections that do not apply inside Grotto: Computer owns install, sessions,
// the CDP connection, and skill distribution.
const removedSections = [
    '## Quickstart',
    '## MCP integration',
    '### Persist session across runs',
    '### Run multiple browsers in parallel',
    '## Diagnosing install issues',
    '## Global flags worth knowing',
    '## When to load another skill',
    '## Full reference',
];

// Paragraph spans that teach shell-only or CLI-only flows (stdin credential
// entry, session flags, reference files that are not materialized).
const removedSpans = [
    { endBefore: /^### /, start: 'Credentials in shell history are a leak.' },
    { endBefore: /^\*\*|^## /, start: '**Authentication expires mid-workflow**' },
    { endBefore: /^## /, start: 'Most normal web tasks (navigate, read, click' },
];

const removedLinePatterns = [/^See \[references\//];

const sentenceScrubs = [
    [/\s*See `references\/[^`]+` for the full rules\./g, ''],
    [/\s*\(see \[references\/[^)]+\)\)/g, ''],
];

// Upstream heredoc examples teach shell chaining the Grotto tool does not
// have; the same commands work by passing the script as one argument.
const exactReplacements = [
    [
        `cat <<'EOF' | agent-browser eval --stdin
const rows = document.querySelectorAll("table tbody tr");
Array.from(rows).map(r => ({
  name: r.cells[0].innerText,
  price: r.cells[1].innerText,
}));
EOF`,
        `agent-browser eval "Array.from(document.querySelectorAll('table tbody tr')).map((r) => ({ name: r.cells[0].innerText, price: r.cells[1].innerText }))"`,
    ],
    [
        'Prefer `eval --stdin` (heredoc) or `eval -b <base64>` for any JS with quotes or special characters. Inline `agent-browser eval "..."` works only for simple expressions.',
        'Pass the whole script as the single argument after `eval`; the args array carries quotes and newlines without any shell escaping.',
    ],
    [
        `**Page needs JS you can't get right in one shot** Use \`eval --stdin\` with a heredoc instead of inline:

\`\`\`bash
cat <<'EOF' | agent-browser eval --stdin
// Complex script with quotes, backticks, whatever
document.querySelectorAll('[data-id]').length
EOF
\`\`\``,
        `**Page needs JS you can't get right in one shot** Pass the full script — quotes, backticks, newlines — as the single \`eval\` argument:

\`\`\`bash
agent-browser eval "document.querySelectorAll('[data-id]').length"
\`\`\``,
    ],
];

// Tokens that must not survive the sync; leftovers mean upstream moved
// guidance around and the transform list needs deliberate review.
const forbiddenTokens = [
    'references/',
    'npm i -g',
    '--restore',
    '--namespace',
    'AGENT_BROWSER_SESSION',
    'skills get',
    '(#when-to-load-another-skill)',
    '--cdp',
    'auth save',
    'plugin add',
    '--stdin',
    "cat <<'EOF'",
];

const grottoPreamble = `# Browser

Control the managed Chrome browser. Grotto owns the browser process, its
durable profile, the session, and the CDP connection; you drive it with one
tool.

## Invocation

You have one tool: \`browser\`. It takes \`args\`, an array of strings in
agent-browser's command vocabulary. The examples below are written in CLI
notation — run each \`agent-browser <arguments>\` line as one \`browser\` tool
call whose \`args\` array holds those arguments:

- \`agent-browser snapshot -i\` → \`browser\` with \`{"args": ["snapshot", "-i"]}\`
- \`agent-browser fill @e3 "user@example.com"\` → \`{"args": ["fill", "@e3", "user@example.com"]}\` — a quoted CLI string is one array item; do not re-quote it.

Never pass connection or session flags, never launch another browser, and
never try to run agent-browser through shell commands. Shell constructs
(pipes, heredocs, redirects, \`cat <<EOF\`) are unavailable — pass multi-line
JavaScript as a single argument: \`{"args": ["eval", "<code>"]}\`.

If the tool reports that the browser is unavailable, tell the user the
reported reason. Browser setup and recovery live in Grotto settings.
`;

function fail(message) {
    console.error(`sync-browser-skill: ${message}`);
    process.exit(1);
}

function headingLevel(line) {
    const match = line.match(/^(#+) /);
    return match ? match[1].length : null;
}

// Marks which lines sit inside fenced code blocks so bash comments never read
// as Markdown headings.
function fencedLineFlags(lines) {
    let inFence = false;
    return lines.map((line) => {
        if (line.trimStart().startsWith('```')) {
            inFence = !inFence;
            return true;
        }
        return inFence;
    });
}

function removeSection(lines, heading) {
    const fenced = fencedLineFlags(lines);
    const start = lines.findIndex((line, index) => !fenced[index] && line.trim() === heading);
    if (start === -1) {
        fail(`expected upstream section "${heading}" was not found; review the upstream skill.`);
    }
    const level = headingLevel(lines[start]);
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
        const lineLevel = fenced[index] ? null : headingLevel(lines[index]);
        if (lineLevel !== null && lineLevel <= level) {
            end = index;
            break;
        }
    }
    lines.splice(start, end - start);
}

function removeSpan(lines, span) {
    const fenced = fencedLineFlags(lines);
    const start = lines.findIndex((line, index) => !fenced[index] && line.startsWith(span.start));
    if (start === -1) {
        fail(`expected upstream paragraph "${span.start}" was not found.`);
    }
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
        if (!fenced[index] && span.endBefore.test(lines[index])) {
            end = index;
            break;
        }
    }
    lines.splice(start, end - start);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
const upstream = fs.readFileSync(path.join(packageDir, 'skill-data', 'core', 'SKILL.md'), 'utf8');

// Drop upstream frontmatter and its H1; Grotto supplies both.
const frontmatterMatch = upstream.match(/^---\n[\s\S]*?\n---\n/);
if (!frontmatterMatch) {
    fail('upstream SKILL.md frontmatter was not found.');
}
let body = upstream.slice(frontmatterMatch[0].length);
const h1Match = body.match(/^\s*# agent-browser core\n/);
if (!h1Match) {
    fail('upstream H1 "# agent-browser core" was not found.');
}
body = body.slice(body.indexOf(h1Match[0]) + h1Match[0].length);

const lines = body.split('\n');
for (const span of removedSpans) {
    removeSpan(lines, span);
}
for (const heading of removedSections) {
    removeSection(lines, heading);
}

let content = lines
    .filter((line) => !removedLinePatterns.some((pattern) => pattern.test(line)))
    .join('\n');
for (const [pattern, replacement] of sentenceScrubs) {
    content = content.replace(pattern, replacement);
}
for (const [needle, replacement] of exactReplacements) {
    if (!content.includes(needle)) {
        fail(`expected upstream passage was not found; review the transforms:\n${needle}`);
    }
    content = content.replace(needle, replacement);
}
content = `${grottoPreamble}\n${content.replace(/\n{3,}/g, '\n\n').trim()}\n`;

for (const token of forbiddenTokens) {
    if (content.includes(token)) {
        fail(
            `token "${token}" survived the sync; upstream moved guidance — review the transforms.`
        );
    }
}

const escaped = content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const generated = `// Generated by scripts/sync-browser-skill.mjs from agent-browser ${packageJson.version}.
// Do not edit by hand; re-run the sync after bumping the agent-browser dependency.

export const browserSkillUpstreamVersion = '${packageJson.version}';

export const browserSkillContent = \`${escaped}\`;
`;

fs.writeFileSync(outputPath, generated);
console.log(
    `sync-browser-skill: wrote ${path.relative(repoRoot, outputPath)} from agent-browser ${packageJson.version}`
);
