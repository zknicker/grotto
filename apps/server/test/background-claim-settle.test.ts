import { afterAll, beforeAll, expect, test } from 'bun:test';
import { and, eq, sql } from 'drizzle-orm';
import { AgentDelivery } from '../src/agent-delivery/delivery.ts';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import { messageTasksTable } from '../src/postgres/schema.ts';
import {
    answerInChat,
    beginRun,
    FakeTransport,
    readTask,
    recordRunOperation,
    replyInThread,
    seedBackgroundClaim,
    seedPeerAgent,
    sendHumanMessage,
    turnSummary,
} from './background-claim-fixture.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

let cluster: PostgresCluster;
let connection: GrottoConnection;

beforeAll(async () => {
    cluster = await startPostgresCluster();
    await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');
    connection = await connectGrottoDatabase(cluster.databaseUrl);
});

afterAll(async () => {
    await connection?.close();
    await cluster?.stop();
});

test('a claim the run answers in the anchor Chat resolves to done and stays background', async () => {
    const claim = await seedBackgroundClaim(connection.db);
    const run = await beginRun(connection.db, claim);
    await answerInChat(connection.db, claim, run.runId);

    await run.delivery.onTurnSettled(claim.computerId, turnSummary(claim.agentId, run.runId));

    // Finished bookkeeping: it is a record, not something to put on a board.
    expect(await readTask(connection.db, claim)).toMatchObject({
        status: 'done',
        tier: 'background',
    });
});

// The managed prompt asks an Agent to acknowledge before deep work, so a reply
// alone cannot mean "finished": only a reply the run wrote nothing after does.
const runClock = (seconds: number) => new Date(Date.UTC(2026, 8, 8, 12, 0, seconds));

test('an acknowledgment the run kept working past leaves the claim tracked', async () => {
    const claim = await seedBackgroundClaim(connection.db);
    const run = await beginRun(connection.db, claim);
    await answerInChat(connection.db, claim, run.runId, runClock(1));
    await recordRunOperation(connection.db, claim, run.runId, runClock(2));

    await run.delivery.onTurnSettled(claim.computerId, turnSummary(claim.agentId, run.runId));

    expect(await readTask(connection.db, claim)).toMatchObject({
        status: 'in_progress',
        tier: 'tracked',
    });
});

test('an acknowledgment, work, then a real answer resolves the claim', async () => {
    const claim = await seedBackgroundClaim(connection.db);
    const run = await beginRun(connection.db, claim);
    await answerInChat(connection.db, claim, run.runId, runClock(1));
    await recordRunOperation(connection.db, claim, run.runId, runClock(2));
    await answerInChat(connection.db, claim, run.runId, runClock(3));

    await run.delivery.onTurnSettled(claim.computerId, turnSummary(claim.agentId, run.runId));

    // The latest reply is the one that counts: it came after the last tool.
    expect(await readTask(connection.db, claim)).toMatchObject({
        status: 'done',
        tier: 'background',
    });
});

test('a reply from a run that used no tools is the whole answer', async () => {
    const claim = await seedBackgroundClaim(connection.db);
    const run = await beginRun(connection.db, claim);
    await answerInChat(connection.db, claim, run.runId, runClock(1));

    await run.delivery.onTurnSettled(claim.computerId, turnSummary(claim.agentId, run.runId));

    expect(await readTask(connection.db, claim)).toMatchObject({
        status: 'done',
        tier: 'background',
    });
});

test('a claim that outlives its settled run stays in progress and becomes tracked', async () => {
    const claim = await seedBackgroundClaim(connection.db);
    const run = await beginRun(connection.db, claim);

    await run.delivery.onTurnSettled(claim.computerId, turnSummary(claim.agentId, run.runId));

    expect(await readTask(connection.db, claim)).toMatchObject({
        status: 'in_progress',
        tier: 'tracked',
    });
});

test('the claimant working in the task Thread makes it tracked instead of auto-done', async () => {
    const claim = await seedBackgroundClaim(connection.db);
    const run = await beginRun(connection.db, claim);
    await answerInChat(connection.db, claim, run.runId);
    await replyInThread(connection.db, claim, { agentId: claim.agentId });

    await run.delivery.onTurnSettled(claim.computerId, turnSummary(claim.agentId, run.runId));

    expect(await readTask(connection.db, claim)).toMatchObject({
        status: 'in_progress',
        tier: 'tracked',
    });
});

// An unmentioned peer Agent replied in the anchor's Thread before the assignee
// had even claimed, and the claim read tracked for its whole life. A Thread is
// where everybody else's chatter is supposed to land; it says nothing about
// whether the claimant's own work needs watching.
test("a peer Agent's Thread reply leaves the claim background and still resolves", async () => {
    const claim = await seedBackgroundClaim(connection.db);
    const peerAgentId = await seedPeerAgent(connection.db, claim);
    await replyInThread(connection.db, claim, { agentId: peerAgentId });
    const run = await beginRun(connection.db, claim);
    await answerInChat(connection.db, claim, run.runId);

    await run.delivery.onTurnSettled(claim.computerId, turnSummary(claim.agentId, run.runId));

    expect(await readTask(connection.db, claim)).toMatchObject({
        status: 'done',
        tier: 'background',
    });
});

test("a bystander's Thread reply does not promote the claim either", async () => {
    const claim = await seedBackgroundClaim(connection.db);
    await replyInThread(connection.db, claim, { userId: claim.userId });

    expect(await readTask(connection.db, claim)).toMatchObject({
        status: 'in_progress',
        tier: 'background',
    });
});

test('a failed run leaves the claim in progress and tracked', async () => {
    const claim = await seedBackgroundClaim(connection.db);
    const run = await beginRun(connection.db, claim);

    await run.delivery.onTurnSettled(
        claim.computerId,
        turnSummary(claim.agentId, run.runId, 'failed')
    );

    expect(await readTask(connection.db, claim)).toMatchObject({
        status: 'in_progress',
        tier: 'tracked',
    });
});

test('a reply from a different run in the same Chat does not close the claim', async () => {
    const claim = await seedBackgroundClaim(connection.db);
    const run = await beginRun(connection.db, claim);
    // Same Agent, same Chat, another run: the only evidence that counts is a
    // reply this run produced, or the claim closes on somebody else's work.
    await answerInChat(connection.db, claim, `${run.runId}-other`);

    await run.delivery.onTurnSettled(claim.computerId, turnSummary(claim.agentId, run.runId));

    expect(await readTask(connection.db, claim)).toMatchObject({
        status: 'in_progress',
        tier: 'tracked',
    });
});

test('a failed run that replied tracks the claim rather than closing it', async () => {
    const claim = await seedBackgroundClaim(connection.db);
    const run = await beginRun(connection.db, claim);
    await answerInChat(connection.db, claim, run.runId);

    await run.delivery.onTurnSettled(
        claim.computerId,
        turnSummary(claim.agentId, run.runId, 'failed')
    );

    expect(await readTask(connection.db, claim)).toMatchObject({
        status: 'in_progress',
        tier: 'tracked',
    });
});

test('a run a human stops leaves its claim tracked and in progress', async () => {
    const claim = await seedBackgroundClaim(connection.db);
    const run = await beginRun(connection.db, claim);

    await run.delivery.stop({ agentId: claim.agentId, serverId: claim.serverId });

    expect(await readTask(connection.db, claim)).toMatchObject({
        live: false,
        status: 'in_progress',
        tier: 'tracked',
    });
});

test('a claim the Agent closed itself settles without a second write', async () => {
    // The Agent prompt tells it to reply and set same-turn work `done` itself.
    // Auto-resolve must be a no-op then: no double-fire, no error, no reopen.
    const claim = await seedBackgroundClaim(connection.db);
    const run = await beginRun(connection.db, claim);
    await answerInChat(connection.db, claim, run.runId);
    await connection.db
        .update(messageTasksTable)
        .set({ status: 'done', version: sql`${messageTasksTable.version} + 1` })
        .where(
            and(
                eq(messageTasksTable.serverId, claim.serverId),
                eq(messageTasksTable.messageId, claim.messageId)
            )
        );
    const closed = await readTask(connection.db, claim);

    await run.delivery.onTurnSettled(claim.computerId, turnSummary(claim.agentId, run.runId));

    expect(await readTask(connection.db, claim)).toMatchObject({
        status: 'done',
        tier: 'background',
        version: closed?.version,
    });
});

test('a task is live while its assignee runs on it and not after settling', async () => {
    const claim = await seedBackgroundClaim(connection.db);
    const run = await beginRun(connection.db, claim);

    expect(await readTask(connection.db, claim)).toMatchObject({ live: true, tier: 'background' });

    await run.delivery.onTurnSettled(claim.computerId, turnSummary(claim.agentId, run.runId));

    expect(await readTask(connection.db, claim)).toMatchObject({ live: false });
});

test('a run serving another message leaves the task idle', async () => {
    const claim = await seedBackgroundClaim(connection.db);
    const other = await sendHumanMessage(connection.db, claim, 'unrelated work');
    const transport = new FakeTransport();
    transport.online.add(claim.computerId);
    const delivery = new AgentDelivery(connection.db, transport);
    await delivery.deliver({
        agentId: claim.agentId,
        chatId: claim.chatId,
        content: 'unrelated work',
        dedupeKey: other,
        serverId: claim.serverId,
    });

    expect(await readTask(connection.db, claim)).toMatchObject({ live: false });
});
