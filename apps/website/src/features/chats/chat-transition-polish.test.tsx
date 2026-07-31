import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMessage } from '../../components/chats/chat-message.tsx';

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

test('chat message prose renders as plain roster text, not a balloon', () => {
    const assistant = renderToStaticMarkup(<ChatMessage from="assistant">Done</ChatMessage>);
    const user = renderToStaticMarkup(<ChatMessage from="user">Done</ChatMessage>);

    for (const markup of [assistant, user]) {
        expect(markup).toContain('data-slot="bubble-content"');
        expect(markup).toContain('text-sm');
        expect(markup).toContain('leading-relaxed');
    }

    // Every message — the owner's included — reads as left-aligned ghost text
    // in one Slack-style roster; only data-from tells the senders apart. Ghost
    // carries no balloon chrome: no rounding, no fill, no padding.
    for (const markup of [assistant, user]) {
        expect(markup).toContain('data-variant="ghost"');
        expect(markup).not.toContain('rounded-xl');
        expect(markup).not.toContain('px-3');
    }
    expect(assistant).toContain('data-from="assistant"');
    expect(user).toContain('data-from="user"');
});

test('chat message wraps long pasted tokens inside the bubble', () => {
    const longToken = `{"client_secret":"${'x'.repeat(256)}"}`;

    for (const from of ['user', 'assistant'] as const) {
        const markup = renderToStaticMarkup(<ChatMessage from={from}>{longToken}</ChatMessage>);

        expect(markup).toContain('data-slot="bubble"');
        expect(markup).toContain('min-w-0');
        expect(markup).toContain('max-w-full');
        expect(markup).toContain('wrap-break-word');
    }
});
