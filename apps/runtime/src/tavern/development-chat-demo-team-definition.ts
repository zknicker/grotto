import { developmentChatTeamDemoId } from '@tavern/api/development-chat-demos';
import {
    assistantMessage,
    type DemoAgentIds,
    type DevelopmentChatDemo,
    demoTime,
    ownerMessage,
} from './development-chat-demo-types';

// Multi-agent demo: two agent seats answering the same request in one
// channel. Exercises the roster facepile, per-seat turn identity, and the
// venue for the dev toolkit's multi-agent simulated turn.
export function teamDemo(ids: DemoAgentIds): DevelopmentChatDemo {
    const chatId = developmentChatTeamDemoId;
    const requestMessageId = 'msg_demo_team_request';
    const ottoRunId = 'run_msg_demo_team_otto_reply';
    const wrenRunId = 'run_msg_demo_team_wren_reply';

    return {
        agentIds: [ids.otto, ids.wren],
        chatId,
        color: '#8b5cf6',
        title: 'team-demo',
        messages: [
            ownerMessage({
                agentId: ids.otto,
                chatId,
                content:
                    'Team check: Otto, what shipped this week? Wren, anything risky in the queue?',
                createdAt: demoTime,
                id: requestMessageId,
                nonce: 'demo-team-request',
            }),
            assistantMessage({
                agentId: ids.otto,
                chatId,
                content:
                    'Shipped this week: the send-anchor scroll fix, per-seat turn identity, and the drawer-based work evidence. Release notes are drafted in the workspace.',
                createdAt: offsetDemoTime(90),
                id: 'msg_demo_team_otto_reply',
                nonce: 'demo-team-otto-reply',
                requestMessageId,
                runId: ottoRunId,
            }),
            assistantMessage({
                agentId: ids.wren,
                chatId,
                content:
                    'Two risky items in the queue: the runtime schema change needs a fresh-database pass, and the calendar plugin token expires Friday. Both are flagged.',
                createdAt: offsetDemoTime(150),
                id: 'msg_demo_team_wren_reply',
                nonce: 'demo-team-wren-reply',
                requestMessageId,
                runId: wrenRunId,
            }),
        ],
    };
}

function offsetDemoTime(seconds: number) {
    return new Date(Date.parse(demoTime) + seconds * 1000).toISOString();
}
