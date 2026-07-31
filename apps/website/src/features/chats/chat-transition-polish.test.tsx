import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMessage } from '../../components/chats/chat-message.tsx';
import { AgentStatusIndicator } from './agent-status-indicator.tsx';

test('agent status indicator keeps a fixed icon box for layout motion', () => {
    const markup = renderToStaticMarkup(
        <AgentStatusIndicator activeReply={null} character="robot" rows={[]} />
    );

    expect(markup).toContain('height:32px');
    expect(markup).toContain('width:32px');
    expect(markup).toContain('Agent idle');
});

test('agent status indicator leaves emotion changes to the eye spring', () => {
    const idleMarkup = renderToStaticMarkup(
        <AgentStatusIndicator activeReply={null} character="robot" rows={[]} />
    );
    const thinkingMarkup = renderToStaticMarkup(
        <AgentStatusIndicator
            activeReply={{
                agentId: 'agent-1',
                isThinking: true,
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-05-13T12:00:00.000Z',
                text: '',
            }}
            character="robot"
            rows={[]}
        />
    );

    expect(getFirstPathData(thinkingMarkup)).toBe(getFirstPathData(idleMarkup));
    expect(thinkingMarkup).toContain('Agent is thinking');
});

test('chat message entrance animation can be disabled for handoffs', () => {
    const animated = renderToStaticMarkup(
        <ChatMessage animateEnter from="user">
            Hello
        </ChatMessage>
    );
    const still = renderToStaticMarkup(
        <ChatMessage animateEnter={false} from="user">
            Hello
        </ChatMessage>
    );

    expect(animated).toContain('opacity:0;transform');
    expect(still).not.toContain('opacity:0;transform');
});

function getFirstPathData(markup: string) {
    return /<path d="([^"]+)"/.exec(markup)?.[1] ?? null;
}

test('chat message prose uses the shadcn bubble content styling', () => {
    const assistant = renderToStaticMarkup(<ChatMessage from="assistant">Done</ChatMessage>);
    const user = renderToStaticMarkup(<ChatMessage from="user">Done</ChatMessage>);

    for (const markup of [assistant, user]) {
        expect(markup).toContain('data-slot="bubble-content"');
        expect(markup).toContain('py-2');
        expect(markup).toContain('leading-relaxed');
    }

    // Every message — the owner's included — reads as left-aligned ghost text
    // in one Slack-style roster; only data-from tells the senders apart.
    for (const markup of [assistant, user]) {
        expect(markup).toContain('rounded-xl');
        expect(markup).toContain('data-variant="ghost"');
    }
    expect(assistant).toContain('data-from="assistant"');
    expect(user).toContain('data-from="user"');
});

test('chat message wraps long pasted tokens inside the bubble', () => {
    const longToken = `{"client_secret":"${'x'.repeat(256)}"}`;

    for (const from of ['user', 'assistant'] as const) {
        const markup = renderToStaticMarkup(<ChatMessage from={from}>{longToken}</ChatMessage>);

        expect(markup).toContain('data-slot="bubble"');
        expect(markup).toContain('max-w-[80%]');
        expect(markup).toContain('min-w-0');
        expect(markup).toContain('max-w-full');
        expect(markup).toContain('wrap-break-word');
    }
});
