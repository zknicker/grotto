import { describe, expect, it } from 'bun:test';
import type { AgentMentionAppearance } from './mention-metadata.ts';
import { applyAgentMentionAppearance, readMentionsFromMarkdown } from './mention-metadata.ts';

describe('readMentionsFromMarkdown', () => {
    it('reads explicit rich reference links from message content', () => {
        const content =
            'Ask [@Grotto](agent://agt_primary), open [@Computer Use](plugin://computer-use@openai-bundled), [@Chrome](app://computer-use/google-chrome), read [$ui](skill://ui), [mentions.md](/Users/zknicker/.codex/worktrees/1b41/grotto/specs/mentions.md), and [components/ui](/Users/zknicker/.codex/worktrees/1b41/grotto/apps/website/src/components/ui)';

        expect(readMentionsFromMarkdown(content)).toEqual([
            {
                end: 34,
                id: 'agent://agt_primary',
                kind: 'agent',
                label: 'Grotto',
                projection: 'agent-reference',
                start: 4,
                text: '[@Grotto](agent://agt_primary)',
            },
            {
                end: 94,
                id: 'plugin://computer-use@openai-bundled',
                kind: 'plugin',
                label: 'Computer Use',
                projection: 'capability-reference',
                start: 41,
                text: '[@Computer Use](plugin://computer-use@openai-bundled)',
            },
            {
                end: 139,
                id: 'app://computer-use/google-chrome',
                kind: 'app',
                label: 'Chrome',
                projection: 'capability-reference',
                start: 96,
                text: '[@Chrome](app://computer-use/google-chrome)',
            },
            {
                end: 163,
                id: 'skill://ui',
                kind: 'skill',
                label: 'ui',
                projection: 'skill-activation',
                start: 146,
                text: '[$ui](skill://ui)',
            },
            {
                end: 242,
                id: '/Users/zknicker/.codex/worktrees/1b41/grotto/specs/mentions.md',
                kind: 'file',
                label: 'mentions.md',
                projection: 'path-reference',
                start: 165,
                text: '[mentions.md](/Users/zknicker/.codex/worktrees/1b41/grotto/specs/mentions.md)',
            },
            {
                end: content.length,
                id: '/Users/zknicker/.codex/worktrees/1b41/grotto/apps/website/src/components/ui',
                kind: 'directory',
                label: 'components/ui',
                projection: 'path-reference',
                start: 248,
                text: '[components/ui](/Users/zknicker/.codex/worktrees/1b41/grotto/apps/website/src/components/ui)',
            },
        ]);
    });

    it('ignores bare mention-looking text', () => {
        expect(readMentionsFromMarkdown('@Grotto and $ui are plain text')).toEqual([]);
    });
});

describe('applyAgentMentionAppearance', () => {
    const appearances: Record<string, AgentMentionAppearance> = {
        agt_blippy: { avatarUrl: '/api/avatars/avt_0123456789abcdef', primaryColor: '#2563eb' },
        agt_plain: { avatarUrl: null, primaryColor: '#f97316' },
    };
    const lookup = (agentId: string | null | undefined): AgentMentionAppearance =>
        (agentId ? appearances[agentId] : undefined) ?? { avatarUrl: null, primaryColor: null };

    it('adds live agent avatar and color metadata to agent mentions', () => {
        const mentions = readMentionsFromMarkdown('Ask [@Blippy](agent://agt_blippy)');

        expect(applyAgentMentionAppearance(mentions, lookup)).toEqual([
            {
                ...mentions[0],
                metadata: {
                    agentAvatarUrl: '/api/avatars/avt_0123456789abcdef',
                    agentColor: '#2563eb',
                },
            },
        ]);
    });

    it('keeps configured color for agents without an uploaded avatar', () => {
        const mentions = readMentionsFromMarkdown('Ask [@Plain](agent://agt_plain)');

        expect(applyAgentMentionAppearance(mentions, lookup)[0]?.metadata).toEqual({
            agentAvatarUrl: null,
            agentColor: '#f97316',
        });
    });

    it('leaves unknown agents and non-agent mentions untouched', () => {
        const mentions = readMentionsFromMarkdown(
            'Ask [@Ghost](agent://agt_ghost) about [$ui](skill://ui)'
        );

        expect(applyAgentMentionAppearance(mentions, lookup)).toEqual(mentions);
    });
});
