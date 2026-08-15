import type { ClaudeUsageSnapshot } from '@tavern/claude-usage';
import type { CodexUsageSnapshot } from '@tavern/codex-usage';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { claudeCodeUsageTable, codexUsageTable, openRouterUsageTable } from '../db/schema.ts';
import type { OpenRouterActivityOverview } from '../openrouter/activity.ts';

const primaryUsageRecordId = 'primary';

const claudeUsageWindowSchema = z.object({
    id: z.enum([
        'current-session',
        'current-week-all-models',
        'current-week-opus',
        'current-week-sonnet',
    ]),
    label: z.string(),
    remainingPercent: z.number(),
    resetsAt: z.string().nullable(),
    usedPercent: z.number(),
});

const claudeUsageSnapshotSchema = z.object({
    capturedAt: z.string(),
    extraUsage: z
        .object({
            monthlyLimitUsd: z.number().nullable(),
            usedUsd: z.number(),
        })
        .nullable(),
    provider: z.literal('claude'),
    source: z.enum(['anthropic-oauth-usage', 'claude-code-sdk-usage']),
    subscriptionType: z.string().nullable(),
    windows: z.array(claudeUsageWindowSchema),
});

const codexUsageWindowSchema = z.object({
    id: z.enum(['current-session', 'current-week']),
    label: z.string(),
    remainingPercent: z.number(),
    resetAfterSeconds: z.number().nullable(),
    resetsAt: z.string().nullable(),
    usedPercent: z.number(),
});

const codexUsageSnapshotSchema = z.object({
    capturedAt: z.string(),
    creditsBalance: z.number().nullable(),
    planType: z.string().nullable(),
    provider: z.literal('codex'),
    source: z.literal('chatgpt-wham-usage'),
    windows: z.array(codexUsageWindowSchema),
});

const openRouterActivityKeySchema = z.object({
    id: z.string(),
    label: z.string(),
    providerName: z.string(),
});

const openRouterActivityPointSchema = z.object({
    date: z.string(),
    values: z.record(z.string(), z.number()),
});

const openRouterActivityOverviewSchema = z.object({
    days: z.number(),
    keys: z.array(openRouterActivityKeySchema),
    message: z.string().nullable(),
    note: z.string().nullable(),
    series: z.array(openRouterActivityPointSchema),
    status: z.enum(['empty', 'ready', 'unconfigured']),
    totalByokUsageUsd: z.number(),
    totalRequests: z.number(),
    totalUsageUsd: z.number(),
});

export class UsageParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UsageParseError';
    }
}

export async function getClaudeUsageSnapshot(): Promise<ClaudeUsageSnapshot | null> {
    const [record] = await db
        .select({
            snapshotJson: claudeCodeUsageTable.snapshotJson,
        })
        .from(claudeCodeUsageTable)
        .where(eq(claudeCodeUsageTable.id, primaryUsageRecordId))
        .limit(1);

    if (!record) {
        return null;
    }

    return parseClaudeUsageSnapshot(record.snapshotJson);
}

export async function saveClaudeUsageSnapshot(snapshot: ClaudeUsageSnapshot) {
    const timestamp = new Date().toISOString();

    await db
        .insert(claudeCodeUsageTable)
        .values({
            capturedAt: snapshot.capturedAt,
            createdAt: timestamp,
            id: primaryUsageRecordId,
            snapshotJson: JSON.stringify(snapshot),
            updatedAt: timestamp,
        })
        .onConflictDoUpdate({
            target: claudeCodeUsageTable.id,
            set: {
                capturedAt: snapshot.capturedAt,
                snapshotJson: JSON.stringify(snapshot),
                updatedAt: timestamp,
            },
        });
}

export async function deleteClaudeUsageSnapshot() {
    await db.delete(claudeCodeUsageTable).where(eq(claudeCodeUsageTable.id, primaryUsageRecordId));
}

export async function getCodexUsageSnapshot(): Promise<CodexUsageSnapshot | null> {
    const [record] = await db
        .select({
            snapshotJson: codexUsageTable.snapshotJson,
        })
        .from(codexUsageTable)
        .where(eq(codexUsageTable.id, primaryUsageRecordId))
        .limit(1);

    if (!record) {
        return null;
    }

    return parseCodexUsageSnapshot(record.snapshotJson);
}

export async function saveCodexUsageSnapshot(snapshot: CodexUsageSnapshot) {
    const timestamp = new Date().toISOString();

    await db
        .insert(codexUsageTable)
        .values({
            capturedAt: snapshot.capturedAt,
            createdAt: timestamp,
            id: primaryUsageRecordId,
            snapshotJson: JSON.stringify(snapshot),
            updatedAt: timestamp,
        })
        .onConflictDoUpdate({
            target: codexUsageTable.id,
            set: {
                capturedAt: snapshot.capturedAt,
                snapshotJson: JSON.stringify(snapshot),
                updatedAt: timestamp,
            },
        });
}

export async function deleteCodexUsageSnapshot() {
    await db.delete(codexUsageTable).where(eq(codexUsageTable.id, primaryUsageRecordId));
}

export async function getOpenRouterUsageOverview(): Promise<OpenRouterActivityOverview | null> {
    const [record] = await db
        .select({
            overviewJson: openRouterUsageTable.overviewJson,
        })
        .from(openRouterUsageTable)
        .where(eq(openRouterUsageTable.id, primaryUsageRecordId))
        .limit(1);

    if (!record) {
        return null;
    }

    return parseOpenRouterUsageOverview(record.overviewJson);
}

export async function saveOpenRouterUsageOverview(
    overview: OpenRouterActivityOverview,
    capturedAt: string
) {
    const timestamp = new Date().toISOString();

    await db
        .insert(openRouterUsageTable)
        .values({
            capturedAt,
            createdAt: timestamp,
            id: primaryUsageRecordId,
            overviewJson: JSON.stringify(overview),
            updatedAt: timestamp,
        })
        .onConflictDoUpdate({
            target: openRouterUsageTable.id,
            set: {
                capturedAt,
                overviewJson: JSON.stringify(overview),
                updatedAt: timestamp,
            },
        });
}

export async function deleteOpenRouterUsageOverview() {
    await db.delete(openRouterUsageTable).where(eq(openRouterUsageTable.id, primaryUsageRecordId));
}

export function parseClaudeUsageSnapshot(snapshotJson: string): ClaudeUsageSnapshot {
    return parseUsageSnapshot(
        snapshotJson,
        claudeUsageSnapshotSchema,
        'Claude Code usage snapshot is invalid.'
    );
}

export function parseCodexUsageSnapshot(snapshotJson: string): CodexUsageSnapshot {
    return parseUsageSnapshot(
        snapshotJson,
        codexUsageSnapshotSchema,
        'Codex usage snapshot is invalid.'
    );
}

export function parseOpenRouterUsageOverview(overviewJson: string): OpenRouterActivityOverview {
    return parseUsageSnapshot(
        overviewJson,
        openRouterActivityOverviewSchema,
        'OpenRouter usage overview is invalid.'
    );
}

function parseUsageSnapshot<TSnapshot>(
    snapshotJson: string,
    schema: z.ZodSchema<TSnapshot>,
    errorMessage: string
): TSnapshot {
    try {
        return schema.parse(JSON.parse(snapshotJson));
    } catch (error) {
        throw new UsageParseError(
            error instanceof Error && error.message.length > 0 ? error.message : errorMessage
        );
    }
}
