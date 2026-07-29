import { createHash } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { computerProtocolVersion } from '@tavern/api';
import { eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    agentsTable,
    channelAgentParticipantsTable,
    channelParticipantsTable,
    chatMessagesTable,
    chatsTable,
    computersTable,
    serverMembershipsTable,
    serversTable,
} from '../postgres/schema.ts';
import { listAccessibleServers } from '../servers/accessible-servers.ts';
import type { ServerSummary } from '../servers/contracts.ts';
import { ensureUserByClerkId } from '../users/grotto-user.ts';

const demoInventory = {
    name: 'Development Mac',
    runtimes: [
        {
            id: 'codex',
            label: 'Codex',
            models: [
                { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
                { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
            ],
        },
    ],
};

/** Creates the one idempotent Server-owned demo workspace for a signed-in dev user. */
export async function seedHostedDevelopmentServer(
    db: GrottoDatabase,
    clerkUserId: string,
    options: {
        computerDataRoot?: string;
        serverOrigin?: string;
    } = {}
): Promise<ServerSummary> {
    const user = await ensureUserByClerkId(db, clerkUserId);
    const existing = await listAccessibleServers(db, user.id);
    if (existing[0]) {
        await ensureDevelopmentComputerAttachment(db, existing[0], options);
        return existing[0];
    }

    const seeded = await db.transaction(async (tx) => {
        const serverId = createOpaqueId('srv');
        const membershipId = createOpaqueId('mem');
        const channelId = createOpaqueId('cht');
        const demoChannelId = createOpaqueId('cht');
        const ottoDmId = createOpaqueId('cht');
        const wrenDmId = createOpaqueId('cht');
        const computerId = createOpaqueId('cmp');
        const ottoId = createOpaqueId('agt');
        const wrenId = createOpaqueId('agt');
        const now = new Date();

        await tx.insert(serversTable).values({
            displayName: 'Dev Server',
            id: serverId,
            slug: 'dev',
        });
        await tx.insert(serverMembershipsTable).values({
            id: membershipId,
            role: 'owner',
            serverId,
            userId: user.id,
        });
        await tx.insert(chatsTable).values({
            id: channelId,
            isAll: true,
            kind: 'channel',
            lastActivityAt: now,
            lastMessageSequence: 3,
            name: 'all',
            serverId,
        });
        await tx.insert(chatsTable).values({
            id: demoChannelId,
            kind: 'channel',
            lastActivityAt: now,
            lastMessageSequence: 2,
            name: 'product',
            serverId,
        });
        await tx.insert(channelParticipantsTable).values({
            chatId: channelId,
            serverId,
            userId: user.id,
        });
        await tx.insert(channelParticipantsTable).values({
            chatId: demoChannelId,
            serverId,
            userId: user.id,
        });
        await tx.insert(computersTable).values({
            architecture: process.arch,
            attachedByUserId: user.id,
            credentialHash: hash(developmentComputerCredential(serverId, computerId)),
            health: 'offline',
            id: computerId,
            operatingSystem: process.platform,
            productVersion: 'dev',
            protocolVersion: computerProtocolVersion,
            reportedInventory: demoInventory,
            serverId,
        });
        await tx
            .insert(agentsTable)
            .values([
                demoAgent(ottoId, computerId, serverId, 'Otto', 'otto', 'gpt-5.6-sol', now),
                demoAgent(wrenId, computerId, serverId, 'Wren', 'wren', 'gpt-5.6-terra', now),
            ]);
        await tx
            .insert(chatsTable)
            .values([
                demoAgentDm(ottoDmId, ottoId, serverId, user.id, now, 1),
                demoAgentDm(wrenDmId, wrenId, serverId, user.id, now, 1),
            ]);
        await tx.insert(channelAgentParticipantsTable).values([
            { agentId: ottoId, chatId: channelId, serverId },
            { agentId: wrenId, chatId: channelId, serverId },
            { agentId: ottoId, chatId: demoChannelId, serverId },
            { agentId: wrenId, chatId: demoChannelId, serverId },
        ]);
        await tx.insert(chatMessagesTable).values([
            demoMessage(serverId, channelId, 1, {
                authorUserId: user.id,
                content: 'Morning team — what should we focus on today?',
            }),
            demoMessage(serverId, channelId, 2, {
                authorAgentId: ottoId,
                content: 'I’ll keep the plan tight and surface decisions early.',
            }),
            demoMessage(serverId, channelId, 3, {
                authorAgentId: wrenId,
                content: 'I’ll pressure-test the details and keep the work grounded.',
            }),
            demoMessage(serverId, demoChannelId, 1, {
                authorUserId: user.id,
                content: 'What should we polish next?',
            }),
            demoMessage(serverId, demoChannelId, 2, {
                authorAgentId: ottoId,
                content: 'The core flow first. Everything else earns its way in.',
            }),
            demoMessage(serverId, ottoDmId, 1, {
                authorAgentId: ottoId,
                content: 'Otto online. What are we building?',
            }),
            demoMessage(serverId, wrenDmId, 1, {
                authorAgentId: wrenId,
                content: 'Wren here. Send me the sharp edges.',
            }),
        ]);

        return { displayName: 'Dev Server', id: serverId, role: 'owner' as const, slug: 'dev' };
    });
    await ensureDevelopmentComputerAttachment(db, seeded, options);
    return seeded;
}

async function ensureDevelopmentComputerAttachment(
    db: GrottoDatabase,
    server: ServerSummary,
    options: { computerDataRoot?: string; serverOrigin?: string }
) {
    const computerDataRoot =
        options.computerDataRoot ?? process.env.GROTTO_COMPUTER_DATA_ROOT?.trim();
    if (!computerDataRoot) {
        return;
    }
    const [computer] = await db
        .select({ id: computersTable.id })
        .from(computersTable)
        .where(eq(computersTable.serverId, server.id))
        .limit(1);
    if (!computer) {
        throw new Error('The development Server has no Computer.');
    }
    const credential = developmentComputerCredential(server.id, computer.id);
    await db
        .update(computersTable)
        .set({ credentialHash: hash(credential) })
        .where(eq(computersTable.id, computer.id));

    const directory = join(computerDataRoot, 'servers', server.id);
    const target = join(directory, 'attachment.json');
    const temporary = join(directory, 'attachment.json.tmp');
    await mkdir(directory, { mode: 0o700, recursive: true });
    await writeFile(
        temporary,
        `${JSON.stringify(
            {
                computerId: computer.id,
                credential,
                serverId: server.id,
                serverOrigin:
                    options.serverOrigin ??
                    process.env.GROTTO_SERVER_ORIGIN ??
                    `http://127.0.0.1:${process.env.GROTTO_SERVER_PORT ?? '18791'}`,
                slug: server.slug,
            },
            null,
            2
        )}\n`,
        { mode: 0o600 }
    );
    await rename(temporary, target);
}

function developmentComputerCredential(serverId: string, computerId: string) {
    return `dev-computer:${serverId}:${computerId}:local-only`;
}

function hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
}

function demoAgentDm(
    id: string,
    agentId: string,
    serverId: string,
    userId: string,
    lastActivityAt: Date,
    lastMessageSequence: number
) {
    return {
        dmAgentId: agentId,
        dmMemberOneStint: 1,
        dmMemberOneUserId: userId,
        id,
        kind: 'dm' as const,
        lastActivityAt,
        lastMessageSequence,
        serverId,
    };
}

function demoAgent(
    id: string,
    computerId: string,
    serverId: string,
    displayName: string,
    handle: string,
    modelId: string,
    reportedAt: Date
) {
    return {
        character: displayName === 'Otto' ? ('robot' as const) : ('bird' as const),
        computerId,
        desiredModelId: modelId,
        desiredRuntimeId: 'codex',
        displayName,
        effectiveMissing: [],
        effectiveModelId: modelId,
        effectiveReportedAt: reportedAt,
        effectiveRuntimeId: 'codex',
        handle,
        homeTimezone: 'America/New_York',
        id,
        role: 'member' as const,
        serverId,
    };
}

function demoMessage(
    serverId: string,
    chatId: string,
    sequence: number,
    author: { authorAgentId: string; content: string } | { authorUserId: string; content: string }
) {
    return {
        ...author,
        chatId,
        id: createOpaqueId('msg'),
        nonce: `dev-${chatId}-${sequence}`,
        sequence,
        serverId,
    };
}
