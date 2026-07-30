import { expect, test } from 'bun:test';
import { createServerUpdateHandler } from './use-server-events.ts';

test('computer events refresh hosted workspace reads without polling', () => {
    const invalidated: string[] = [];
    const invalidate = (name: string) => async () => {
        invalidated.push(name);
    };
    const utils = {
        agent: {
            list: { invalidate: invalidate('agent.list') },
            skillFile: { invalidate: invalidate('agent.skillFile') },
            workspaceFile: { invalidate: invalidate('agent.workspaceFile') },
            workspaceFiles: { invalidate: invalidate('agent.workspaceFiles') },
        },
        computer: { list: { invalidate: invalidate('computer.list') } },
        invitation: { list: { invalidate: invalidate('invitation.list') } },
        mcp: { list: { invalidate: invalidate('mcp.list') } },
        member: { list: { invalidate: invalidate('member.list') } },
        server: {
            bySlug: { invalidate: invalidate('server.bySlug') },
            list: { invalidate: invalidate('server.list') },
        },
        stats: { live: { invalidate: invalidate('stats.live') } },
    };

    createServerUpdateHandler(
        utils as Parameters<typeof createServerUpdateHandler>[0],
        'server-one'
    )({ scope: 'computer' });

    expect(invalidated).toEqual([
        'computer.list',
        'agent.list',
        'agent.skillFile',
        'agent.workspaceFile',
        'agent.workspaceFiles',
        'stats.live',
    ]);
});
