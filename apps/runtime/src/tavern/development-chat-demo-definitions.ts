import { developmentChatDemoId } from '@tavern/api/development-chat-demos';
import {
    artifactLinksDemo,
    attachmentDemo,
    longContentDemo,
    selfMessagesDemo,
} from './development-chat-demo-basic-definitions';
import { teamDemo } from './development-chat-demo-team-definition';
import {
    type DemoAgentIds,
    type DevelopmentChatDemo,
    type DevelopmentDemoMessage,
    demoTime,
} from './development-chat-demo-types';
import { visualsChannelDemo } from './development-chat-demo-visuals-channel-definition';

export function developmentChatDemos(ids: DemoAgentIds): DevelopmentChatDemo[] {
    return [
        demoChannel(ids.otto, [
            artifactLinksDemo(ids.otto),
            longContentDemo(ids.otto),
            attachmentDemo(ids.otto),
            selfMessagesDemo(ids.otto),
        ]),
        teamDemo(ids),
        visualsChannelDemo(ids.otto),
    ];
}

function demoChannel(ottoId: string, demos: DevelopmentChatDemo[]): DevelopmentChatDemo {
    return {
        agentIds: [ottoId],
        chatId: developmentChatDemoId,
        color: '#0ea5e9',
        messages: demos.flatMap((demo) => demo.messages).map(sequenceDemoMessage),
        title: 'demo',
    };
}

function sequenceDemoMessage(
    message: DevelopmentDemoMessage,
    index: number
): DevelopmentDemoMessage {
    return {
        ...message,
        createdAt: demoTimestamp(index),
    };
}

function demoTimestamp(index: number) {
    return new Date(Date.parse(demoTime) + index * 45_000).toISOString();
}
