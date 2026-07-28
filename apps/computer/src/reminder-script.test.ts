import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseReminderScriptCommand, runReminderScript } from './reminder-script.ts';

let dataRoot: string;

beforeEach(async () => {
    dataRoot = await mkdtemp(join(tmpdir(), 'grotto-reminder-script-'));
});

afterEach(async () => {
    await rm(dataRoot, { force: true, recursive: true });
});

test('runs a reminder script once in the Agent workspace and replays its result', async () => {
    const command = parseReminderScriptCommand({
        agentId: 'agt_reminder',
        attentionId: 'rma_reminder',
        fireId: 'rmf_reminder',
        reminderId: 'rmd_reminder',
        script: 'printf first; printf marker > marker.txt',
        type: 'reminder-script',
    });
    if (!command) {
        throw new Error('Fixture command did not parse.');
    }

    const first = await runReminderScript({ command, dataRoot, serverId: 'srv_reminder' });
    expect(first).toMatchObject({ exitCode: 0, output: 'first', timedOut: false });
    const marker = join(
        dataRoot,
        'servers',
        'srv_reminder',
        'agents',
        'agt_reminder',
        'workspace',
        'marker.txt'
    );
    expect(await readFile(marker, 'utf8')).toBe('marker');

    const second = await runReminderScript({
        command: { ...command, script: 'printf second; printf changed > marker.txt' },
        dataRoot,
        serverId: 'srv_reminder',
    });
    expect(second).toEqual(first);
    expect(await readFile(marker, 'utf8')).toBe('marker');
});

test('coalesces concurrent delivery of the same reminder script', async () => {
    const command = parseReminderScriptCommand({
        agentId: 'agt_concurrent',
        attentionId: 'rma_concurrent',
        fireId: 'rmf_concurrent',
        reminderId: 'rmd_concurrent',
        script: 'printf x >> executions.txt; sleep 0.05; printf done',
        type: 'reminder-script',
    });
    if (!command) {
        throw new Error('Fixture command did not parse.');
    }

    const [first, second] = await Promise.all([
        runReminderScript({ command, dataRoot, serverId: 'srv_concurrent' }),
        runReminderScript({ command, dataRoot, serverId: 'srv_concurrent' }),
    ]);

    expect(second).toEqual(first);
    expect(
        await readFile(
            join(
                dataRoot,
                'servers',
                'srv_concurrent',
                'agents',
                'agt_concurrent',
                'workspace',
                'executions.txt'
            ),
            'utf8'
        )
    ).toBe('x');
});

test('runs with a minimal environment instead of Computer process secrets', async () => {
    const prior = process.env.GROTTO_REMINDER_TEST_SECRET;
    process.env.GROTTO_REMINDER_TEST_SECRET = 'must-not-leak';
    try {
        const command = parseReminderScriptCommand({
            agentId: 'agt_environment',
            attentionId: 'att_environment0001',
            fireId: 'rmf_environment',
            reminderId: 'rmd_environment',
            script: `printf '%s\\n%s\\n%s' "$GROTTO_REMINDER_TEST_SECRET" "$HOME" "$(command -v sh)"`,
            type: 'reminder-script',
        });
        if (!command) {
            throw new Error('Fixture command did not parse.');
        }
        const serverId = 'srv_environment';
        const result = await runReminderScript({ command, dataRoot, serverId });

        expect(result.output).not.toContain('must-not-leak');
        expect(result.output).toContain(
            join(dataRoot, 'servers', serverId, 'agents', command.agentId, 'home')
        );
        expect(result.output).toMatch(/\/sh$/mu);
    } finally {
        if (prior === undefined) {
            process.env.GROTTO_REMINDER_TEST_SECRET = undefined;
        } else {
            process.env.GROTTO_REMINDER_TEST_SECRET = prior;
        }
    }
});

test('bounds combined multibyte output by UTF-8 bytes', async () => {
    const command = parseReminderScriptCommand({
        agentId: 'agt_multibyte',
        attentionId: 'att_multibyte000001',
        fireId: 'rmf_multibyte',
        reminderId: 'rmd_multibyte',
        script: `printf '🙂%.0s' {1..30000}`,
        type: 'reminder-script',
    });
    if (!command) {
        throw new Error('Fixture command did not parse.');
    }

    const result = await runReminderScript({
        command,
        dataRoot,
        serverId: 'srv_multibyte',
    });
    expect(Buffer.byteLength(result.output)).toBeLessThanOrEqual(65_536);
    expect(result.output.endsWith('🙂')).toBe(true);
});
