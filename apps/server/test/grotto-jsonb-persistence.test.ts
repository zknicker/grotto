import { afterAll, beforeAll, expect, test } from 'bun:test';
import { recordComputerInventory } from '../src/computers/service.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import { recordAgentEffectiveState } from '../src/server-agents/record-agent-effective-state.ts';
import {
    clearGrottoAgentState,
    recordGrottoAgentState,
} from '../src/server-agents/record-grotto-agent-state.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let connection: GrottoConnection;

const computerId = 'cmp_jsonbtest0000000';
const agentId = 'agt_jsonbtest0000000';
const omittedAgentId = 'agt_jsonbomitted00000';
const otherComputerId = 'cmp_jsonbother000000';
const otherAgentId = 'agt_jsonbother000000';

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
        values
            (
                ${computerId},
                'srv_jsonbtest000000',
                'usr_jsonbtest000000',
                ${'a'.repeat(64)}
            ),
            (
                ${otherComputerId},
                'srv_jsonbtest000000',
                'usr_jsonbtest000000',
                ${'b'.repeat(64)}
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
        values
            (
                ${agentId},
                'srv_jsonbtest000000',
                ${computerId},
                'Cove',
                'jsonb-cove',
                'UTC',
                'member',
                'codex',
                'gpt-5.6-sol'
            ),
            (
                ${omittedAgentId},
                'srv_jsonbtest000000',
                ${computerId},
                'Scout',
                'jsonb-scout',
                'UTC',
                'member',
                'codex',
                'gpt-5.6-sol'
            ),
            (
                ${otherAgentId},
                'srv_jsonbtest000000',
                ${otherComputerId},
                'Other',
                'jsonb-other',
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
            reasoningEffort: 'high',
            runtimeId: 'codex',
        },
    ]);
    await recordGrottoAgentState(connection.db, computerId, [
        {
            agentId,
            appliedAt: '2026-08-28T16:00:00.000Z',
            status: 'current',
            version: '1.0.0',
        },
    ]);

    const [types] = await harness.sql<
        {
            effective_grotto_agent_applied_at: Date;
            effective_grotto_agent_status: string;
            effective_grotto_agent_version: string;
            effective_missing: string;
            effective_reasoning_effort: string;
            reported_inventory: string;
        }[]
    >`
        select
            agents.effective_grotto_agent_applied_at,
            agents.effective_grotto_agent_status,
            agents.effective_grotto_agent_version,
            jsonb_typeof(agents.effective_missing) as effective_missing,
            agents.effective_reasoning_effort,
            jsonb_typeof(computers.reported_inventory) as reported_inventory
        from agents
        join computers on computers.id = agents.computer_id
        where agents.id = ${agentId}
    `;
    expect(types).toMatchObject({
        effective_grotto_agent_status: 'current',
        effective_grotto_agent_version: '1.0.0',
        effective_missing: 'array',
        effective_reasoning_effort: 'high',
        reported_inventory: 'object',
    });
    expect(types?.effective_grotto_agent_applied_at.toISOString()).toBe('2026-08-28T16:00:00.000Z');

    await clearGrottoAgentState(connection.db, computerId);
    const [cleared] = await harness.sql<
        {
            effective_grotto_agent_applied_at: Date | null;
            effective_grotto_agent_status: string | null;
            effective_grotto_agent_version: string | null;
        }[]
    >`
        select
            effective_grotto_agent_applied_at,
            effective_grotto_agent_status,
            effective_grotto_agent_version
        from agents
        where id = ${agentId}
    `;
    expect(cleared).toEqual({
        effective_grotto_agent_applied_at: null,
        effective_grotto_agent_status: null,
        effective_grotto_agent_version: null,
    });
});

test('Grotto Agent reports replace one Computer snapshot without crossing assignments', async () => {
    await harness.sql`
        update agents
        set effective_grotto_agent_applied_at = '2026-08-27T16:00:00.000Z',
            effective_grotto_agent_status = 'current',
            effective_grotto_agent_version = '0.9.0'
        where id in (${agentId}, ${omittedAgentId})
    `;
    await harness.sql`
        update agents
        set effective_grotto_agent_applied_at = '2026-08-26T16:00:00.000Z',
            effective_grotto_agent_status = 'current',
            effective_grotto_agent_version = '8.8.8'
        where id = ${otherAgentId}
    `;

    await recordGrottoAgentState(connection.db, computerId, [
        {
            agentId,
            appliedAt: '2026-08-28T16:00:00.000Z',
            status: 'current',
            version: '1.0.0',
        },
        {
            agentId: otherAgentId,
            appliedAt: '2026-08-28T16:00:00.000Z',
            status: 'current',
            version: '1.0.0',
        },
    ]);

    const rows = await harness.sql<
        {
            effective_grotto_agent_applied_at: Date | null;
            effective_grotto_agent_status: string | null;
            effective_grotto_agent_version: string | null;
            id: string;
        }[]
    >`
        select
            id,
            effective_grotto_agent_applied_at,
            effective_grotto_agent_status,
            effective_grotto_agent_version
        from agents
        where id in (${agentId}, ${omittedAgentId}, ${otherAgentId})
        order by case id
            when ${agentId} then 0
            when ${omittedAgentId} then 1
            else 2
        end
    `;
    expect(rows).toEqual([
        {
            effective_grotto_agent_applied_at: new Date('2026-08-28T16:00:00.000Z'),
            effective_grotto_agent_status: 'current',
            effective_grotto_agent_version: '1.0.0',
            id: agentId,
        },
        {
            effective_grotto_agent_applied_at: null,
            effective_grotto_agent_status: null,
            effective_grotto_agent_version: null,
            id: omittedAgentId,
        },
        {
            effective_grotto_agent_applied_at: new Date('2026-08-26T16:00:00.000Z'),
            effective_grotto_agent_status: 'current',
            effective_grotto_agent_version: '8.8.8',
            id: otherAgentId,
        },
    ]);
});
