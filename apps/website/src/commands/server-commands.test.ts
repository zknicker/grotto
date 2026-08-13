import { describe, expect, test } from 'bun:test';
import type { Agent, Chat } from '@tavern/api';
import { buildCommandGroups, getCurrentChatId } from './server-commands.ts';

const agent = {
    displayName: 'Cove',
    handle: 'cove',
    id: 'agt_cove',
} as Agent;
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
] as Chat[];

describe('hosted command groups', () => {
    test('preserves hosted navigation, chats, current-chat actions, settings, and developer groups', () => {
        const navigated: string[] = [];
        const groups = buildCommandGroups({
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
        const titles = groups.flatMap((group) => group.commands.map((command) => command.title));
        expect(titles).toContain('Focus Composer');
        expect(titles).toContain('Agent Profile');
        expect(titles).not.toContain('Reminders');
        expect(groups.find((group) => group.id === 'developer')?.commands).toHaveLength(2);

        groups.find((group) => group.id === 'direct-messages')?.commands[0]?.run();
        expect(navigated).toEqual(['/s/dev/chats/cht_cove']);
    });

    test('recognizes hosted chat routes and omits operator commands for members', () => {
        expect(getCurrentChatId('/s/dev/chats/cht_cove', 'dev')).toBe('cht_cove');
        expect(getCurrentChatId('/s/dev/tasks', 'dev')).toBeNull();

        const navigated: string[] = [];
        const groups = buildCommandGroups({
            agents: [agent],
            chats,
            devMode: false,
            navigate: (path) => navigated.push(path),
            pathname: '/s/dev/tasks',
            role: 'member',
            serverSlug: 'dev',
            setDevMode: () => undefined,
        });
        const titles = groups.flatMap((group) => group.commands.map((command) => command.title));

        expect(titles).not.toContain('Activity');
        expect(titles).not.toContain('Computers');
        expect(titles).not.toContain('Reminders');

        groups
            .find((group) => group.id === 'navigation')
            ?.commands.find((command) => command.title === 'Chat')
            ?.run();
        expect(navigated).toEqual(['/s/dev']);
    });

    test('omits a retired Agent DM from chat commands', () => {
        const retiredChats = chats.map((chat) =>
            chat.id === 'cht_cove'
                ? {
                      ...chat,
                      peerAgentDisplayName: 'Cove',
                      peerAgentRetired: true,
                  }
                : chat
        );
        const groups = buildCommandGroups({
            agents: [],
            chats: retiredChats,
            devMode: false,
            navigate: () => undefined,
            pathname: '/s/dev/chats/cht_cove',
            role: 'owner',
            serverSlug: 'dev',
            setDevMode: () => undefined,
        });
        const titles = groups.flatMap((group) => group.commands.map((command) => command.title));

        expect(titles).not.toContain('Cove');
        expect(titles).not.toContain('Focus Composer');
    });
});
