import { describe, expect, test } from 'bun:test';
import type { HostedAgent, HostedChat } from '@tavern/api';
import { buildHostedCommandGroups, getCurrentHostedChatId } from './hosted-commands.ts';

const agent = {
    displayName: 'Cove',
    handle: 'cove',
    id: 'agt_cove',
} as HostedAgent;
const chats = [
    {
        id: 'cht_all',
        isAll: true,
        kind: 'channel',
        name: 'all',
        peerAgentId: null,
    },
    {
        id: 'cht_cove',
        isAll: false,
        kind: 'dm',
        name: null,
        peerAgentId: agent.id,
        peerUserId: null,
    },
] as HostedChat[];

describe('hosted command groups', () => {
    test('preserves hosted navigation, chats, current-chat actions, settings, and developer groups', () => {
        const navigated: string[] = [];
        const groups = buildHostedCommandGroups({
            agents: [agent],
            chats,
            devMode: false,
            navigate: (path) => navigated.push(path),
            pathname: '/s/dev/chats/cht_cove',
            role: 'owner',
            serverSlug: 'dev',
            setDevMode: () => undefined,
        });

        expect(groups.map((group) => group.title)).toEqual([
            'Navigation',
            'Channels',
            'Direct Messages',
            'Current Chat',
            'Settings',
            'Developer',
        ]);
        expect(groups.flatMap((group) => group.commands.map((command) => command.title))).toContain(
            'Focus Composer'
        );
        expect(groups.flatMap((group) => group.commands.map((command) => command.title))).toContain(
            'Agent Profile'
        );
        expect(groups.find((group) => group.id === 'developer')?.commands).toHaveLength(2);

        groups.find((group) => group.id === 'direct-messages')?.commands[0]?.run();
        expect(navigated).toEqual(['/s/dev/chats/cht_cove']);
    });

    test('recognizes hosted chat routes and omits operator commands for members', () => {
        expect(getCurrentHostedChatId('/s/dev/chats/cht_cove', 'dev')).toBe('cht_cove');
        expect(getCurrentHostedChatId('/s/dev/activity', 'dev')).toBeNull();

        const groups = buildHostedCommandGroups({
            agents: [agent],
            chats,
            devMode: false,
            navigate: () => undefined,
            pathname: '/s/dev/activity',
            role: 'member',
            serverSlug: 'dev',
            setDevMode: () => undefined,
        });
        const titles = groups.flatMap((group) => group.commands.map((command) => command.title));

        expect(titles).not.toContain('Computers');
        expect(titles).not.toContain('Reminders');
    });
});
