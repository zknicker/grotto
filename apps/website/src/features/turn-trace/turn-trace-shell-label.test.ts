import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatShellLabel,
    readShellCommandSummary,
    unwrapShellCommand,
} from './turn-trace-shell-label.ts';

test('a Codex zsh wrapper is unwrapped to the command it ran', () => {
    assert.equal(
        unwrapShellCommand(`/bin/zsh -lc "pwd && sed -n '1,240p' MEMORY.md"`),
        `pwd && sed -n '1,240p' MEMORY.md`
    );
    assert.equal(unwrapShellCommand(`zsh -lc 'ls -la'`), 'ls -la');
    assert.equal(unwrapShellCommand('bash -lc "echo hi"'), 'echo hi');
    assert.equal(unwrapShellCommand('sh -c "echo hi"'), 'echo hi');
});

test('an escaped quote inside a double-quoted wrapper is restored', () => {
    assert.equal(
        unwrapShellCommand('/bin/zsh -lc "grotto message send --target \\"#all\\""'),
        'grotto message send --target "#all"'
    );
});

test('something that is not a wrapper is left alone', () => {
    assert.equal(unwrapShellCommand('rg --files'), 'rg --files');
    // `-l` alone runs a login shell on a script file, not a command line.
    assert.equal(unwrapShellCommand('zsh -l script.sh'), 'zsh -l script.sh');
});

test('the summary is the first line without its heredoc opener', () => {
    assert.equal(
        readShellCommandSummary(
            `/bin/zsh -lc "grotto message send --target \\"#all\\" <<'GROTTOMSG'\nbody\nGROTTOMSG"`
        ),
        'grotto message send --target "#all"'
    );
    assert.equal(readShellCommandSummary('cat <<EOF\ntext\nEOF'), 'cat');
    assert.equal(readShellCommandSummary('  \n  echo   spaced   out  '), 'echo spaced out');
});

test('a long command is capped so the row stays one line', () => {
    const label = formatShellLabel(`rg ${'pattern '.repeat(30).trim()}`);

    assert.equal(label.length, 84);
    assert.ok(label.startsWith('Ran rg pattern'));
    assert.ok(label.endsWith('…'));
});

test('a grotto command reads as the product verb it is', () => {
    assert.equal(
        formatShellLabel(`/bin/zsh -lc "grotto message send --target \\"#all\\" <<'GROTTOMSG'"`),
        'Sent a message with grotto'
    );
    assert.equal(
        formatShellLabel(`/bin/zsh -lc 'grotto message send --send-draft --target "#all"'`),
        'Sent a message with grotto'
    );
    assert.equal(
        formatShellLabel(`zsh -lc 'grotto message check'`),
        'Checked messages with grotto'
    );
    assert.equal(formatShellLabel(`zsh -lc 'grotto inbox check'`), 'Checked inbox with grotto');
    assert.equal(formatShellLabel('grotto task claim --number 3'), 'Claimed a task with grotto');
    assert.equal(formatShellLabel(`grotto ask "what changed"`), 'Asked a question with grotto');
});

test('a grotto command with no verb of its own still states what ran', () => {
    assert.equal(formatShellLabel('grotto skill list'), 'Ran grotto skill list');
    assert.equal(formatShellLabel(`zsh -lc 'ls -la'`), 'Ran ls -la');
    assert.equal(formatShellLabel('   '), 'Ran a command');
});
