import { afterAll, beforeAll, expect, test } from 'bun:test';
import { recordComputerInventory } from '../src/computers/service.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import { recordAgentEffectiveState } from '../src/server-agents/record-agent-effective-state.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let connection: GrottoConnection;

const computerId = 'cmp_jsonbtest0000000';
const agentId = 'agt_jsonbtest0000000';

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    connection = await connectGrottoDatabase(harness.databaseUrl);
    await harness.sql`
        insert into users (id, clerk_user_id)
        values ('usr_jsonbtest000000', 'clerk_jsonbtest')
    `;
    await harness.sql`
        insert into servers (id, slug, display_name)
        values ('srv_jsonbtest000000', 'jsonb-test', 'JSONB Test')
    `;
    await harness.sql`
        insert into server_memberships (id, server_id, user_id, role)
        values (
            'mem_jsonbtest000000',
            'srv_jsonbtest000000',
            'usr_jsonbtest000000',
            'owner'
        )
    `;
    await harness.sql`
        insert into computers (id, server_id, attached_by_user_id, credential_hash)
        values (
            ${computerId},
            'srv_jsonbtest000000',
            'usr_jsonbtest000000',
            ${'a'.repeat(64)}
        )
    `;
    await harness.sql`
        insert into agents (
            id,
            server_id,
            computer_id,
            display_name,
            handle,
            home_timezone,
            role,
            desired_runtime_id,
            desired_model_id
        )
        values (
            ${agentId},
            'srv_jsonbtest000000',
            ${computerId},
            'Cove',
            'jsonb-cove',
            'UTC',
            'member',
            'codex',
            'gpt-5.6-sol'
        )
    `;
});

afterAll(async () => {
    await connection.close();
    await harness.close();
});

test('Drizzle writes JSONB values as objects and arrays instead of JSON strings', async () => {
    const inventory = {
        runtimes: [
            {
                id: 'codex',
                label: 'Codex',
                models: [{ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }],
            },
        ],
    };
    await recordComputerInventory(connection.db, computerId, inventory);
    await recordAgentEffectiveState(connection.db, computerId, [
        {
            agentId,
            missingResources: ['runtime:codex'],
            modelId: 'gpt-5.6-sol',
            runtimeId: 'codex',
        },
    ]);

    const [types] = await harness.sql<
        {
            effective_missing: string;
            reported_inventory: string;
        }[]
    >`
        select
            jsonb_typeof(agents.effective_missing) as effective_missing,
            jsonb_typeof(computers.reported_inventory) as reported_inventory
        from agents
        join computers on computers.id = agents.computer_id
        where agents.id = ${agentId}
    `;
    expect(types).toEqual({
        effective_missing: 'array',
        reported_inventory: 'object',
    });
});
