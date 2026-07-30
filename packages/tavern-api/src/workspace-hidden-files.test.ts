import { describe, expect, test } from 'bun:test';
import {
    hostedAgentWorkspaceListInputSchema,
    hostedAgentWorkspaceReadInputSchema,
} from './hosted-agent.ts';
import { hostedAgentWorkspaceRequestSchema } from './hosted-agent-runner.ts';
import { agentRuntimeWorkspaceFileListInputSchema } from './runtime/contracts.ts';

describe('workspace hidden-file contracts', () => {
    test('defaults discovery to hidden files off', () => {
        expect(agentRuntimeWorkspaceFileListInputSchema.parse({ path: '' }).includeHidden).toBe(
            false
        );
        expect(
            hostedAgentWorkspaceListInputSchema.parse({
                agentId: 'agt_1234567890123456',
                path: '',
                serverId: 'srv_1234567890123456',
            }).includeHidden
        ).toBe(false);
    });

    test('carries the explicit visibility choice through list and read requests', () => {
        const list = hostedAgentWorkspaceRequestSchema.parse({
            agentId: 'agt_1234567890123456',
            operation: { includeHidden: true, kind: 'list', path: '.drafts' },
            requestId: 'req_1234567890123456',
            type: 'agent-workspace-request',
        });
        const read = hostedAgentWorkspaceReadInputSchema.parse({
            agentId: 'agt_1234567890123456',
            includeHidden: true,
            path: '.drafts/plan.md',
            serverId: 'srv_1234567890123456',
        });
        expect(list.operation.includeHidden).toBe(true);
        expect(read.includeHidden).toBe(true);
    });
});
