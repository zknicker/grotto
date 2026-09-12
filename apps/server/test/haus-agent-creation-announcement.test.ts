import { expect, test } from 'bun:test';
import { agentCreationFixture } from './agent-creation-fixture.ts';

const fixture = agentCreationFixture();

test('an announcement that names nobody is refused before an avatar is generated', async () => {
    const runner = await fixture.mintRunner('run_create_unnamed');
    const before = fixture.avatarRequests.length;

    const refused = await fixture.postCreate(
        runner,
        fixture.createBody({
            avatarConcept: 'a moonlit raccoon cartographer',
            content: 'Bringing on a teammate for the delivery lane.',
            displayName: 'Nameless',
            nonce: 'create-unnamed',
        })
    );

    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({
        code: 'AGENT_CREATE_ANNOUNCEMENT_MISSING_HANDLE',
        handle: 'nameless',
        nextAction: 'Mention @nameless in --say and run the command again.',
    });
    expect(await countAgentsNamed('Nameless')).toBe(0);
    expect(fixture.avatarRequests.length, 'no generation is spent on a refusal').toBe(before);
});

test('a colliding display name earns a suffixed handle the announcement must name', async () => {
    const runner = await fixture.mintRunner('run_create_collision');
    const stale = await fixture.postCreate(
        runner,
        fixture.createBody({ displayName: 'Orbit', nonce: 'create-collision' })
    );

    // The caller predicted @orbit from the name; @orbit was taken, so the
    // refusal hands back the handle the Server actually minted.
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({
        code: 'AGENT_CREATE_ANNOUNCEMENT_MISSING_HANDLE',
        handle: 'orbit-2',
    });
    expect(await countAgentsNamed('Orbit')).toBe(1);

    const collided = await fixture.postCreate(
        runner,
        fixture.createBody({
            content: 'Bringing on @orbit-2 for the delivery lane.',
            displayName: 'Orbit',
            nonce: 'create-collision',
        })
    );

    expect(collided.status).toBe(200);
    expect(collided.body.agent?.handle).toBe('orbit-2');
});

async function countAgentsNamed(displayName: string) {
    const [row] = (await fixture.harness.sql`
        select count(*)::int as total from agents
        where server_id = ${fixture.serverId} and display_name = ${displayName}
    `) as { total: number }[];
    return row.total;
}
