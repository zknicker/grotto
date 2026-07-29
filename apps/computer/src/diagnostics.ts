import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { validateComputerBridgeAssets } from './harness/bridge-bootstrap.ts';
import type { Attachment } from './launch.ts';

interface AttachmentStatus {
    runner: 'running' | 'stopped';
    serverId: string;
    slug: string;
}

export async function readComputerStatus(dataRoot: string): Promise<{
    attachments: AttachmentStatus[];
    service: 'running' | 'stopped';
}> {
    const stopped = await exists(join(dataRoot, 'stopped'));
    const attachments = await readAttachments(dataRoot);
    return {
        attachments: await Promise.all(
            attachments.map(async (attachment) => {
                const marker = await readRunnerMarker(dataRoot, attachment.serverId);
                return {
                    runner: marker && isPidAlive(marker.pid) ? 'running' : 'stopped',
                    serverId: attachment.serverId,
                    slug: attachment.slug,
                };
            })
        ),
        service: stopped ? 'stopped' : 'running',
    };
}

export async function doctorComputer(
    dataRoot: string,
    validate: (attachment: Attachment) => Promise<void>
): Promise<{ checks: { label: string; ok: boolean }[]; healthy: boolean }> {
    const checks: { label: string; ok: boolean }[] = [];
    const root = await stat(dataRoot).catch(() => null);
    checks.push({
        label: 'Data root exists and is private',
        ok: Boolean(root?.isDirectory() && (root.mode & 0o077) === 0),
    });
    const attachments = await readAttachments(dataRoot);
    checks.push({ label: 'At least one Server is attached', ok: attachments.length > 0 });
    checks.push({
        label: 'Bundled Agent runtimes are ready',
        ok: await validateComputerBridgeAssets()
            .then(() => true)
            .catch(() => false),
    });
    for (const attachment of attachments) {
        const path = join(dataRoot, 'servers', attachment.serverId, 'attachment.json');
        const info = await stat(path).catch(() => null);
        checks.push({
            label: `/${attachment.slug} credential file is private`,
            ok: Boolean(info?.isFile() && (info.mode & 0o077) === 0),
        });
        checks.push({
            label: `/${attachment.slug} Server accepts this Computer`,
            ok: await validate(attachment)
                .then(() => true)
                .catch(() => false),
        });
    }
    return { checks, healthy: checks.every((check) => check.ok) };
}

export async function readComputerLogs(dataRoot: string, lines = 200): Promise<string> {
    const content = await readFile(join(dataRoot, 'logs', 'computer.log'), 'utf8').catch(() => '');
    return content
        .trimEnd()
        .split('\n')
        .slice(-Math.max(1, Math.min(lines, 2000)))
        .join('\n');
}

export function formatComputerStatus(status: Awaited<ReturnType<typeof readComputerStatus>>) {
    const attachments =
        status.attachments.length === 0
            ? 'No Servers attached.'
            : status.attachments
                  .map((item) => `/${item.slug}: ${item.runner} (${item.serverId})`)
                  .join('\n');
    return `Service: ${status.service}\n${attachments}`;
}

export function formatDoctor(result: Awaited<ReturnType<typeof doctorComputer>>) {
    return result.checks.map((check) => `${check.ok ? 'PASS' : 'FAIL'} ${check.label}`).join('\n');
}

async function readAttachments(dataRoot: string): Promise<Attachment[]> {
    const root = join(dataRoot, 'servers');
    const entries = await readdir(root).catch(() => []);
    const attachments = await Promise.all(
        entries.map(async (serverId) => {
            try {
                return JSON.parse(
                    await readFile(join(root, serverId, 'attachment.json'), 'utf8')
                ) as Attachment;
            } catch {
                return null;
            }
        })
    );
    return attachments
        .filter((item): item is Attachment => item !== null)
        .sort((left, right) => left.slug.localeCompare(right.slug));
}

async function readRunnerMarker(dataRoot: string, serverId: string) {
    try {
        const value = JSON.parse(
            await readFile(join(dataRoot, 'servers', serverId, 'runner.pid'), 'utf8')
        ) as { pid?: unknown };
        return typeof value.pid === 'number' ? { pid: value.pid } : null;
    } catch {
        return null;
    }
}

function isPidAlive(pid: number) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

async function exists(path: string) {
    return await stat(path)
        .then(() => true)
        .catch(() => false);
}
