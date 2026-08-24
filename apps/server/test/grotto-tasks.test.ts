import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = createGrottoClient(harness, await harness.clerk.mintSessionToken('user_task_owner'));
});

afterAll(async () => {
    owner.close();
    await harness.close();
});

test('promotes one canonical Server message into its deterministic Thread work surface', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Server',
        slug: 'task-server',
    });
    const chatId = server.channels[0].id;
    const sent = await owner.trpc.chat.send.mutate({
        chatId,
        content: 'Audit the Server export',
        nonce: 'task-promote-message',
        serverId: server.id,
    });

    const promoted = await owner.trpc.task.promote.mutate({
        messageId: sent.message.id,
        serverId: server.id,
    });
    const replayed = await owner.trpc.task.promote.mutate({
        messageId: sent.message.id,
        serverId: server.id,
    });

    expect(promoted).toMatchObject({
        idempotent: false,
        task: {
            assigneeUserId: null,
            chatId,
            messageId: sent.message.id,
            number: 1,
            status: 'todo',
            threadChatId: `cht_thr_${sent.message.id.slice('msg_'.length)}`,
            version: 1,
        },
    });
    expect(replayed).toEqual({ ...promoted, idempotent: true });
    const promotionEvents = await owner.trpc.chat.events.query({
        afterCursor: sent.eventCursor,
        serverId: server.id,
    });
    expect(promotionEvents.map(({ messageId, type }) => ({ messageId, type }))).toEqual([
        { messageId: sent.message.id, type: 'task.created' },
    ]);
    await expect(owner.trpc.task.list.query({ serverId: server.id })).resolves.toMatchObject([
        {
            message: { content: 'Audit the Server export', id: sent.message.id },
            task: { messageId: sent.message.id, number: 1 },
        },
    ]);
    const promotionMessages = await owner.trpc.chat.messages.query({ chatId, serverId: server.id });
    expect(promotionMessages.messages).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                id: sent.message.id,
                task: expect.objectContaining({
                    messageId: sent.message.id,
                    number: 1,
                    status: 'todo',
                }),
            }),
        ])
    );
    expect(promotionMessages.messages.some((message) => message.author.kind === 'system')).toBe(
        false
    );
});

test('does not promote a system message into human work', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Untaskable System Message',
        slug: 'untaskable-system-message',
    });
    const chatId = server.channels[0].id;
    await harness.sql`
        insert into chat_messages (
            id, server_id, chat_id, sequence, nonce, content, system_author
        )
        values (
            'msg_system_untaskable', ${server.id}, ${chatId}, 1,
            'system_untaskable', 'Reminder fired.', 'reminder'
        )
    `;

    await expect(
        owner.trpc.task.promote.mutate({
            messageId: 'msg_system_untaskable',
            serverId: server.id,
        })
    ).rejects.toThrow(/human or Agent messages.*top-level Channel or DM/i);
});

test('creates a task-message atomically and replays the same nonce idempotently', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Create',
        slug: 'task-create',
    });
    const chatId = server.channels[0].id;
    const input = {
        chatId,
        content: 'Ship the task lane',
        nonce: 'task-create-once',
        serverId: server.id,
    };

    const created = await owner.trpc.task.create.mutate(input);
    const replayed = await owner.trpc.task.create.mutate(input);

    expect(created).toMatchObject({
        idempotent: false,
        task: { messageId: created.task.messageId, number: 1, origin: 'composed' },
    });
    expect(replayed).toEqual({ ...created, idempotent: true });
    await expect(owner.trpc.task.list.query({ serverId: server.id })).resolves.toHaveLength(1);
    const creationEvents = await owner.trpc.chat.events.query({
        afterCursor: '0',
        serverId: server.id,
    });
    expect(creationEvents.map(({ messageId, type }) => ({ messageId, type }))).toEqual([
        { messageId: created.task.messageId, type: 'message.created' },
        { messageId: created.task.messageId, type: 'task.created' },
    ]);
    const creationMessages = await owner.trpc.chat.messages.query({ chatId, serverId: server.id });
    expect(creationMessages.messages).toHaveLength(1);
    expect(creationMessages.messages[0]?.id).toBe(created.task.messageId);
});

test('lists the task Thread summary and DM peer identity', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Thread Summary',
        slug: 'task-thread-summary',
    });
    const peer = await addTaskPeer(server.id, server.channels[0].id);
    const dm = await owner.trpc.chat.ensureDm.mutate({
        peerUserId: peer.userId,
        serverId: server.id,
    });
    const created = await owner.trpc.task.create.mutate({
        chatId: dm.id,
        content: 'Discuss this privately',
        nonce: 'task-thread-summary-create',
        serverId: server.id,
    });
    await owner.trpc.chat.send.mutate({
        chatId: dm.id,
        content: 'First task reply',
        nonce: 'task-thread-summary-reply',
        serverId: server.id,
        thread: { anchorMessageId: created.task.messageId },
    });
    await owner.trpc.thread.setFollow.mutate({
        follow: false,
        serverId: server.id,
        threadChatId: created.task.threadChatId,
    });

    await expect(owner.trpc.task.list.query({ serverId: server.id })).resolves.toMatchObject([
        {
            chatKind: 'dm',
            chatName: null,
            chatPeerUserId: peer.userId,
            threadSummary: {
                anchorMessageId: created.task.messageId,
                followed: false,
                replyCount: 1,
                threadChatId: created.task.threadChatId,
            },
        },
    ]);
    peer.client.close();
});

test('rejects task creation in a Thread as a bad request', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Thread Create',
        slug: 'task-thread-create',
    });
    const chatId = server.channels[0].id;
    const created = await owner.trpc.task.create.mutate({
        chatId,
        content: 'Parent task',
        nonce: 'task-thread-parent',
        serverId: server.id,
    });

    await expect(
        owner.trpc.task.create.mutate({
            chatId: created.task.threadChatId,
            content: 'Nested task',
            nonce: 'task-thread-nested',
            serverId: server.id,
        })
    ).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } });
});

test('maps task creation by an unknown Grotto User to not found', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Unknown User',
        slug: 'task-unknown-user',
    });
    const stranger = createGrottoClient(
        harness,
        await harness.clerk.mintSessionToken('user_task_stranger')
    );

    await expect(
        stranger.trpc.task.create.mutate({
            chatId: server.channels[0].id,
            content: 'Invisible task',
            nonce: 'task-unknown-user-create',
            serverId: server.id,
        })
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } });
    stranger.close();
});

test('allows self-claim during creation but reserves another member for admins', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Create Authority',
        slug: 'task-create-authority',
    });
    const chatId = server.channels[0].id;
    const peer = await addTaskPeer(server.id, chatId);
    const [{ userId: ownerUserId }] = (await harness.sql`
        select user_id as "userId"
        from server_memberships
        where server_id = ${server.id} and role = 'owner'
    `) as { userId: string }[];

    const selfClaimed = await peer.client.trpc.task.create.mutate({
        assigneeUserId: peer.userId,
        chatId,
        content: 'Start this myself',
        nonce: 'task-create-self-claim',
        serverId: server.id,
    });
    expect(selfClaimed.task).toMatchObject({
        assigneeUserId: peer.userId,
        status: 'in_progress',
    });
    await expect(
        peer.client.trpc.task.create.mutate({
            assigneeUserId: ownerUserId,
            chatId,
            content: 'Reserve this for the owner',
            nonce: 'task-create-other-assignee',
            serverId: server.id,
        })
    ).rejects.toThrow(/admin|owner/i);
    peer.client.close();
});

test('rejects a revoked assignee during task creation', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Create Revoked',
        slug: 'task-create-revoked',
    });
    const chatId = server.channels[0].id;
    const peer = await addTaskPeer(server.id, chatId);
    await harness.sql`
        update server_memberships
        set revoked_at = now()
        where server_id = ${server.id} and user_id = ${peer.userId}
    `;

    await expect(
        owner.trpc.task.create.mutate({
            assigneeUserId: peer.userId,
            chatId,
            content: 'Do not reserve',
            nonce: 'task-create-revoked-assignee',
            serverId: server.id,
        })
    ).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } });
    peer.client.close();
});

test('replays an existing task after its reserved assignee is revoked', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Create Replay Revoked',
        slug: 'task-create-replay-revoked',
    });
    const chatId = server.channels[0].id;
    const peer = await addTaskPeer(server.id, chatId);
    const input = {
        assigneeUserId: peer.userId,
        chatId,
        content: 'Replay this reservation',
        nonce: 'task-create-replay-revoked-assignee',
        serverId: server.id,
    };
    const created = await owner.trpc.task.create.mutate(input);
    await harness.sql`
        update server_memberships
        set revoked_at = now()
        where server_id = ${server.id} and user_id = ${peer.userId}
    `;

    await expect(owner.trpc.task.create.mutate(input)).resolves.toEqual({
        ...created,
        idempotent: true,
    });
    peer.client.close();
});

test('serializes concurrent claims without double ownership', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Claims',
        slug: 'task-claims',
    });
    const chatId = server.channels[0].id;
    const peer = await addTaskPeer(server.id, chatId);
    const created = await owner.trpc.task.create.mutate({
        chatId,
        content: 'Claim exactly once',
        nonce: 'task-concurrent-claim',
        serverId: server.id,
    });

    const claims = await Promise.allSettled([
        owner.trpc.task.claim.mutate({
            expectedVersion: created.task.version,
            messageId: created.task.messageId,
            serverId: server.id,
        }),
        peer.client.trpc.task.claim.mutate({
            expectedVersion: created.task.version,
            messageId: created.task.messageId,
            serverId: server.id,
        }),
    ]);

    expect(claims.filter((claim) => claim.status === 'fulfilled')).toHaveLength(1);
    expect(claims.filter((claim) => claim.status === 'rejected')).toHaveLength(1);
    const [task] = await owner.trpc.task.list.query({ serverId: server.id });
    expect(task.task).toMatchObject({
        assigneeUserId: expect.stringMatching(/^usr_/u),
        status: 'in_progress',
        version: 2,
    });
    peer.client.close();
});

test('restricts reservations to admins and preserves status when an owner unassigns', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Assignment',
        slug: 'task-assignment',
    });
    const chatId = server.channels[0].id;
    const peer = await addTaskPeer(server.id, chatId);
    const created = await owner.trpc.task.create.mutate({
        chatId,
        content: 'Reserve this task',
        nonce: 'task-assignment-message',
        serverId: server.id,
    });

    await expect(
        peer.client.trpc.task.assign.mutate({
            assignee: { kind: 'human', userId: peer.userId },
            expectedVersion: created.task.version,
            messageId: created.task.messageId,
            serverId: server.id,
        })
    ).rejects.toThrow(/admin|owner/i);

    const assigned = await owner.trpc.task.assign.mutate({
        assignee: { kind: 'human', userId: peer.userId },
        expectedVersion: created.task.version,
        messageId: created.task.messageId,
        serverId: server.id,
    });
    expect(assigned.task).toMatchObject({
        assigneeAgentId: null,
        assigneeUserId: peer.userId,
        claimedAt: null,
        status: 'todo',
        version: 2,
    });

    const claimed = await peer.client.trpc.task.claim.mutate({
        expectedVersion: assigned.task.version,
        messageId: assigned.task.messageId,
        serverId: server.id,
    });
    expect(claimed.task).toMatchObject({
        assigneeUserId: peer.userId,
        claimedAt: expect.any(String),
        status: 'in_progress',
        version: 3,
    });

    const unassigned = await owner.trpc.task.assign.mutate({
        assignee: null,
        expectedVersion: claimed.task.version,
        messageId: assigned.task.messageId,
        serverId: server.id,
    });
    expect(unassigned.task).toMatchObject({
        assigneeAgentId: null,
        assigneeUserId: null,
        claimedAt: null,
        status: 'in_progress',
        version: 4,
    });
    peer.client.close();
});

test('serializes competing reservations at one expected task version', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Reservation Race',
        slug: 'task-reservation-race',
    });
    const chatId = server.channels[0].id;
    const firstPeer = await addTaskPeer(server.id, chatId);
    const secondPeer = await addTaskPeer(server.id, chatId);
    const created = await owner.trpc.task.create.mutate({
        chatId,
        content: 'Reserve for exactly one member',
        nonce: 'task-reservation-race',
        serverId: server.id,
    });

    const reservations = await Promise.allSettled([
        owner.trpc.task.assign.mutate({
            assignee: { kind: 'human', userId: firstPeer.userId },
            expectedVersion: created.task.version,
            messageId: created.task.messageId,
            serverId: server.id,
        }),
        owner.trpc.task.assign.mutate({
            assignee: { kind: 'human', userId: secondPeer.userId },
            expectedVersion: created.task.version,
            messageId: created.task.messageId,
            serverId: server.id,
        }),
    ]);

    expect(reservations.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(reservations.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const [listed] = await owner.trpc.task.list.query({ serverId: server.id });
    expect([firstPeer.userId, secondPeer.userId]).toContain(listed.task.assigneeUserId);
    expect(listed.task.version).toBe(2);
    firstPeer.client.close();
    secondPeer.client.close();
});

test('rejects reservations for revoked members or members without parent Chat access', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Assignee Access',
        slug: 'task-assignee-access',
    });
    const chatId = server.channels[0].id;
    const peer = await addTaskPeer(server.id, chatId);
    const created = await owner.trpc.task.create.mutate({
        chatId,
        content: 'Validate the reservation target',
        nonce: 'task-assignee-access',
        serverId: server.id,
    });

    await harness.sql`
        delete from channel_participants
        where server_id = ${server.id} and chat_id = ${chatId} and user_id = ${peer.userId}
    `;
    await expect(
        owner.trpc.task.assign.mutate({
            assignee: { kind: 'human', userId: peer.userId },
            expectedVersion: created.task.version,
            messageId: created.task.messageId,
            serverId: server.id,
        })
    ).rejects.toThrow(/access to the parent Chat/i);

    await harness.sql`
        insert into channel_participants (server_id, chat_id, user_id)
        values (${server.id}, ${chatId}, ${peer.userId})
    `;
    await harness.sql`
        update server_memberships
        set revoked_at = now()
        where server_id = ${server.id} and user_id = ${peer.userId}
    `;
    await expect(
        owner.trpc.task.assign.mutate({
            assignee: { kind: 'human', userId: peer.userId },
            expectedVersion: created.task.version,
            messageId: created.task.messageId,
            serverId: server.id,
        })
    ).rejects.toThrow(/active Server member/i);
    peer.client.close();
});

test('lists only admin-visible human assignees with parent Chat access', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Assignee Options',
        slug: 'task-assignee-options',
    });
    const chatId = server.channels[0].id;
    const peer = await addTaskPeer(server.id, chatId);
    const created = await owner.trpc.task.create.mutate({
        chatId,
        content: 'Choose an eligible human',
        nonce: 'task-assignee-options',
        serverId: server.id,
    });

    await expect(
        owner.trpc.task.assignees.query({
            messageId: created.task.messageId,
            serverId: server.id,
        })
    ).resolves.toEqual(
        expect.arrayContaining([
            expect.objectContaining({ kind: 'human', role: 'owner' }),
            { kind: 'human', role: 'member', userId: peer.userId },
        ])
    );
    await expect(
        peer.client.trpc.task.assignees.query({
            messageId: created.task.messageId,
            serverId: server.id,
        })
    ).rejects.toThrow(/admin|owner/i);

    await harness.sql`
        delete from channel_participants
        where server_id = ${server.id} and chat_id = ${chatId} and user_id = ${peer.userId}
    `;
    await expect(
        owner.trpc.task.assignees.query({
            messageId: created.task.messageId,
            serverId: server.id,
        })
    ).resolves.not.toContainEqual({ role: 'member', userId: peer.userId });
    peer.client.close();
});

test('updates status, priority, and task-specific Server labels with expected versions', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Metadata',
        slug: 'task-metadata',
    });
    const chatId = server.channels[0].id;
    const peer = await addTaskPeer(server.id, chatId);
    const created = await owner.trpc.task.create.mutate({
        chatId,
        content: 'Review task metadata',
        nonce: 'task-metadata-message',
        serverId: server.id,
    });
    const label = await peer.client.trpc.taskLabel.create.mutate({
        name: 'backend',
        serverId: server.id,
    });

    const updated = await peer.client.trpc.task.update.mutate({
        expectedVersion: created.task.version,
        messageId: created.task.messageId,
        patch: {
            labelIds: [label.label?.id as string],
            priority: 'high',
            status: 'in_review',
        },
        serverId: server.id,
    });
    expect(updated.task).toMatchObject({
        labels: [{ id: label.label?.id, name: 'backend' }],
        priority: 'high',
        status: 'in_review',
        version: 2,
    });
    await expect(
        owner.trpc.task.update.mutate({
            expectedVersion: created.task.version,
            messageId: created.task.messageId,
            patch: { status: 'done' },
            serverId: server.id,
        })
    ).rejects.toThrow(/changed|refresh/i);
    peer.client.close();
});

test('lets the current owner unclaim without changing task status', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Unclaim',
        slug: 'task-unclaim',
    });
    const created = await owner.trpc.task.create.mutate({
        chatId: server.channels[0].id,
        content: 'Release this claim',
        nonce: 'task-unclaim-message',
        serverId: server.id,
    });
    const claimed = await owner.trpc.task.claim.mutate({
        expectedVersion: created.task.version,
        messageId: created.task.messageId,
        serverId: server.id,
    });

    const released = await owner.trpc.task.unclaim.mutate({
        expectedVersion: claimed.task.version,
        messageId: claimed.task.messageId,
        serverId: server.id,
    });

    expect(released.task).toMatchObject({
        assigneeAgentId: null,
        assigneeUserId: null,
        claimedAt: null,
        status: 'in_progress',
        version: 3,
    });
});

test('keeps task-label management Server-scoped and admin-controlled', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Labels',
        slug: 'task-labels',
    });
    const peer = await addTaskPeer(server.id, server.channels[0].id);
    const created = await peer.client.trpc.taskLabel.create.mutate({
        name: 'needs-review',
        serverId: server.id,
    });

    await expect(
        peer.client.trpc.taskLabel.update.mutate({
            color: 'purple',
            labelId: created.label?.id as string,
            serverId: server.id,
        })
    ).rejects.toThrow(/admin|owner/i);
    const renamed = await owner.trpc.taskLabel.update.mutate({
        color: 'purple',
        labelId: created.label?.id as string,
        name: 'review',
        serverId: server.id,
    });
    expect(renamed.label).toMatchObject({ color: 'purple', name: 'review' });
    await owner.trpc.taskLabel.delete.mutate({
        labelId: created.label?.id as string,
        serverId: server.id,
    });
    await expect(owner.trpc.taskLabel.list.query({ serverId: server.id })).resolves.toEqual([]);
    peer.client.close();
});

test('concurrent task-label creation converges on one Server label', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Label Race',
        slug: 'task-label-race',
    });

    const labels = await Promise.all([
        owner.trpc.taskLabel.create.mutate({
            name: 'Backend',
            serverId: server.id,
        }),
        owner.trpc.taskLabel.create.mutate({
            name: 'backend',
            serverId: server.id,
        }),
    ]);

    expect(labels[0]?.label?.id).toBe(labels[1]?.label?.id);
    await expect(owner.trpc.taskLabel.list.query({ serverId: server.id })).resolves.toHaveLength(1);
});

test('maps a case-insensitive task-label rename collision to a conflict', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Label Rename',
        slug: 'task-label-rename',
    });
    const backend = await owner.trpc.taskLabel.create.mutate({
        name: 'Backend',
        serverId: server.id,
    });
    await owner.trpc.taskLabel.create.mutate({
        name: 'Bug',
        serverId: server.id,
    });

    await expect(
        owner.trpc.taskLabel.update.mutate({
            labelId: backend.label?.id as string,
            name: 'bug',
            serverId: server.id,
        })
    ).rejects.toThrow(/already exists/i);
});

test('denies task reads and writes after Server membership is revoked', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Revocation',
        slug: 'task-revocation',
    });
    const peer = await addTaskPeer(server.id, server.channels[0].id);
    const created = await owner.trpc.task.create.mutate({
        chatId: server.channels[0].id,
        content: 'Remain private after revocation',
        nonce: 'task-revoked-member',
        serverId: server.id,
    });

    await harness.sql`
        update server_memberships
        set revoked_at = now()
        where server_id = ${server.id} and user_id = ${peer.userId}
    `;

    await expect(peer.client.trpc.task.list.query({ serverId: server.id })).rejects.toThrow(
        /not a member/i
    );
    await expect(
        peer.client.trpc.task.claim.mutate({
            expectedVersion: created.task.version,
            messageId: created.task.messageId,
            serverId: server.id,
        })
    ).rejects.toThrow(/not a member/i);
    peer.client.close();
});

test('does not resolve a task message through a different Server tenant', async () => {
    const firstServer = await owner.trpc.server.create.mutate({
        displayName: 'Task Tenant One',
        slug: 'task-tenant-one',
    });
    const secondServer = await owner.trpc.server.create.mutate({
        displayName: 'Task Tenant Two',
        slug: 'task-tenant-two',
    });
    const created = await owner.trpc.task.create.mutate({
        chatId: firstServer.channels[0].id,
        content: 'Stay in the first Server',
        nonce: 'task-cross-server',
        serverId: firstServer.id,
    });

    await expect(
        owner.trpc.task.promote.mutate({
            messageId: created.task.messageId,
            serverId: secondServer.id,
        })
    ).rejects.toThrow(/no taskable message/i);
    await expect(
        owner.trpc.task.claim.mutate({
            expectedVersion: created.task.version,
            messageId: created.task.messageId,
            serverId: secondServer.id,
        })
    ).rejects.toThrow(/no task exists/i);
    await expect(owner.trpc.task.list.query({ serverId: secondServer.id })).resolves.toEqual([]);
});

test('requires every task event to identify its authorized parent Chat', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Event Shape',
        slug: 'task-event-shape',
    });
    const created = await owner.trpc.task.create.mutate({
        chatId: server.channels[0].id,
        content: 'Keep event authorization concrete',
        nonce: 'task-event-shape',
        serverId: server.id,
    });
    const insertInvalidEvent = async () => {
        await harness.sql`
            insert into chat_events (
                cursor, id, server_id, chat_id, event_type, message_id, sequence
            )
            values (
                999999,
                ${`evt_${crypto.randomUUID()}`},
                ${server.id},
                null,
                'task.updated',
                ${created.task.messageId},
                1
            )
        `;
    };

    await expect(insertInvalidEvent()).rejects.toThrow(/chat_events_shape/i);
});

test('recovers task state and exact invalidation events after a Server restart', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Recovery',
        slug: 'task-recovery',
    });
    const created = await owner.trpc.task.create.mutate({
        chatId: server.channels[0].id,
        content: 'Survive the Server restart',
        nonce: 'task-recovery',
        serverId: server.id,
    });
    const beforeClaim = await owner.trpc.chat.events.query({
        afterCursor: '0',
        serverId: server.id,
    });
    const claimed = await owner.trpc.task.claim.mutate({
        expectedVersion: created.task.version,
        messageId: created.task.messageId,
        serverId: server.id,
    });

    owner.close();
    await harness.restart();
    owner = createGrottoClient(harness, await harness.clerk.mintSessionToken('user_task_owner'));

    await expect(owner.trpc.task.list.query({ serverId: server.id })).resolves.toMatchObject([
        {
            task: {
                assigneeUserId: claimed.task.assigneeUserId,
                messageId: created.task.messageId,
                version: claimed.task.version,
            },
        },
    ]);
    await expect(
        owner.trpc.chat.events.query({
            afterCursor: beforeClaim.at(-1)?.cursor as string,
            serverId: server.id,
        })
    ).resolves.toMatchObject([
        {
            chatId: server.channels[0].id,
            messageId: created.task.messageId,
            type: 'task.updated',
        },
    ]);
});

async function addTaskPeer(serverId: string, chatId: string) {
    const clerkUserId = `user_task_peer_${crypto.randomUUID()}`;
    const client = createGrottoClient(harness, await harness.clerk.mintSessionToken(clerkUserId));
    await client.trpc.server.create.mutate({
        displayName: 'Task Peer Root',
        slug: `task-peer-${crypto.randomUUID().slice(0, 8)}`,
    });
    const [{ id: userId }] = (await harness.sql`
        select id from users where clerk_user_id = ${clerkUserId}
    `) as { id: string }[];
    await harness.sql`
        insert into server_memberships (id, server_id, user_id, role)
        values (${`mem_${crypto.randomUUID()}`}, ${serverId}, ${userId}, 'member')
    `;
    await harness.sql`
        insert into channel_participants (server_id, chat_id, user_id)
        values (${serverId}, ${chatId}, ${userId})
    `;

    return { client, userId };
}

test('assigns a task to an Agent, wakes it, and keeps the receipt out of the App', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Agent Assignment',
        slug: 'task-agent-assignment',
    });
    const chatId = server.channels[0].id;
    const agent = await addTaskAgent(server.id, chatId);
    const created = await owner.trpc.task.create.mutate({
        chatId,
        content: 'Hand this to an Agent',
        nonce: 'task-agent-assignment-message',
        serverId: server.id,
    });

    const assigned = await owner.trpc.task.assign.mutate({
        assignee: { agentId: agent.agentId, kind: 'agent' },
        expectedVersion: created.task.version,
        messageId: created.task.messageId,
        serverId: server.id,
    });
    // Assignment reserves: it never carries a claim and never moves status.
    expect(assigned.task).toMatchObject({
        assigneeAgentId: agent.agentId,
        assigneeUserId: null,
        claimedAt: null,
        status: 'todo',
    });

    // The Agent is subscribed to the task thread, or it would wake, claim, and
    // then silently miss every reply.
    const follows = (await harness.sql`
        select followed from agent_thread_follows
        where server_id = ${server.id} and agent_id = ${agent.agentId}
    `) as { followed: boolean }[];
    expect([...follows].map((row) => row.followed)).toEqual([true]);

    // A private receipt wakes the assignee. It sits alongside the canonical task
    // message the Agent already received as a Channel participant.
    const deliveries = (await harness.sql`
        select mentioned, source from agent_pending_work
        where server_id = ${server.id} and agent_id = ${agent.agentId}
    `) as { mentioned: boolean; source: string }[];
    expect([...deliveries].filter((row) => row.source === 'system' && row.mentioned)).toHaveLength(
        1
    );

    // ...and never appears in the human transcript.
    const history = await owner.trpc.chat.messages.query({ chatId, serverId: server.id });
    expect(history.messages.some((message) => message.content.includes('📌 Assigned'))).toBe(false);
});

test('rejects assigning an Agent that does not belong to the parent Chat', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Agent Outsider',
        slug: 'task-agent-outsider',
    });
    const chatId = server.channels[0].id;
    const outsider = await addTaskAgent(server.id, null);
    const created = await owner.trpc.task.create.mutate({
        chatId,
        content: 'Outsiders cannot own this',
        nonce: 'task-agent-outsider-message',
        serverId: server.id,
    });

    await expect(
        owner.trpc.task.assign.mutate({
            assignee: { agentId: outsider.agentId, kind: 'agent' },
            expectedVersion: created.task.version,
            messageId: created.task.messageId,
            serverId: server.id,
        })
    ).rejects.toThrow(/parent Chat/iu);
});

test('rejects assigning a retired Agent', async () => {
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Task Agent Retired',
        slug: 'task-agent-retired',
    });
    const chatId = server.channels[0].id;
    const agent = await addTaskAgent(server.id, chatId);
    await harness.sql`
        update agents set retired_at = now()
        where server_id = ${server.id} and id = ${agent.agentId}
    `;
    const created = await owner.trpc.task.create.mutate({
        chatId,
        content: 'A retired Agent will never wake',
        nonce: 'task-agent-retired-message',
        serverId: server.id,
    });

    await expect(
        owner.trpc.task.assign.mutate({
            assignee: { agentId: agent.agentId, kind: 'agent' },
            expectedVersion: created.task.version,
            messageId: created.task.messageId,
            serverId: server.id,
        })
    ).rejects.toThrow(/active Agent/iu);
});

async function addTaskAgent(serverId: string, chatId: null | string) {
    const computerId = `cmp_${randomBytes(12).toString('base64url')}`;
    const agentId = `agt_${randomBytes(12).toString('base64url')}`;
    const handle = `ada-${crypto.randomUUID().slice(0, 8)}`;
    const [{ id: attachedByUserId }] = (await harness.sql`
        select user_id as id from server_memberships
        where server_id = ${serverId} and role = 'owner' limit 1
    `) as { id: string }[];
    await harness.sql`
        insert into computers (id, server_id, attached_by_user_id, credential_hash)
        values (${computerId}, ${serverId}, ${attachedByUserId}, ${randomBytes(32).toString('hex')})
    `;
    await harness.sql`
        insert into agents (
            id, server_id, computer_id, handle, display_name, role,
            desired_model_id, desired_runtime_id, home_timezone
        )
        values (
            ${agentId}, ${serverId}, ${computerId}, ${handle}, 'Ada', 'member',
            'fake-model', 'fake', 'UTC'
        )
    `;
    if (chatId) {
        await harness.sql`
            insert into channel_agent_participants (server_id, chat_id, agent_id)
            values (${serverId}, ${chatId}, ${agentId})
        `;
    }
    return { agentId, handle };
}
