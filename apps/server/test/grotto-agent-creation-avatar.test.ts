import { expect, test } from 'bun:test';
import { agentCreationFixture } from './agent-creation-fixture.ts';

const fixture = agentCreationFixture();

test('a generated avatar is written onto the created Agent', async () => {
    const runner = await fixture.mintRunner('run_create_avatar_success');

    const created = await fixture.postCreate(
        runner,
        fixture.createBody({
            avatarConcept: 'a brass compass',
            displayName: 'Compass',
            nonce: 'create-avatar-success',
        })
    );

    expect(created.status).toBe(200);
    expect(created.body.avatar).toMatchObject({ status: 'generated' });
    expect(created.body.agent?.avatarUrl).not.toBeNull();
    expect(await fixture.readAgentRow(created.body.agent?.agentId ?? '')).toMatchObject({
        avatar_id: expect.any(String),
    });
});

test('an unprovisioned avatar provider degrades instead of blocking the creation', async () => {
    fixture.setAvatarMode('unavailable');
    const runner = await fixture.mintRunner('run_create_avatar_unavailable');

    const created = await fixture.postCreate(
        runner,
        fixture.createBody({
            avatarConcept: 'a copper owl',
            displayName: 'Owl',
            nonce: 'create-avatar-unavailable',
        })
    );
    fixture.setAvatarMode('success');

    expect(created.status).toBe(200);
    expect(created.body.avatar).toEqual({
        code: 'AVATAR_PROVIDER_UNAVAILABLE',
        note: 'Avatar generation is not configured on this Server.',
        status: 'unavailable',
    });
    expect(created.body.agent?.avatarUrl).toBeNull();
});

test('a transient avatar failure refuses the whole request and creates nothing', async () => {
    fixture.setAvatarMode('fail');
    const runner = await fixture.mintRunner('run_create_avatar_busy');

    const refused = await fixture.postCreate(
        runner,
        fixture.createBody({
            avatarConcept: 'a storm lantern',
            displayName: 'Lantern',
            nonce: 'create-avatar-busy',
        })
    );
    fixture.setAvatarMode('success');

    expect(refused.status).toBe(502);
    expect(refused.body).toMatchObject({ code: 'AVATAR_PROVIDER_FAILED', retryable: true });
    expect(await countAgentsNamed('Lantern')).toBe(0);
    expect(
        await fixture.harness.sql`
            select id from chat_messages where nonce = 'create-avatar-busy'
        `
    ).toHaveLength(0);
});

async function countAgentsNamed(displayName: string) {
    const [row] = (await fixture.harness.sql`
        select count(*)::int as total from agents
        where server_id = ${fixture.serverId} and display_name = ${displayName}
    `) as { total: number }[];
    return row.total;
}

// The retry's Agent already wears the avatar the first request generated, so
// spending another 75 s provider call on it would also let a transient
// generation failure refuse a request that already succeeded.
test('a replayed create spends no second avatar generation', async () => {
    const runner = await fixture.mintRunner('run_create_avatar_replay');
    const body = fixture.createBody({
        avatarConcept: 'a paper lantern',
        displayName: 'Lantern',
        nonce: 'create-avatar-replay',
    });

    const first = await fixture.postCreate(runner, body);
    expect(first.status).toBe(200);
    expect(first.body.avatar).toMatchObject({ status: 'generated' });
    const spent = fixture.avatarRequests.length;

    const replay = await fixture.postCreate(runner, body);

    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({
        agent: { agentId: first.body.agent?.agentId },
        idempotent: true,
    });
    expect(fixture.avatarRequests.length, 'no generation is spent on a replay').toBe(spent);
});
