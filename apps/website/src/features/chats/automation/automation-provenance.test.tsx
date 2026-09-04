import { expect, test } from 'bun:test';
import type { AutomationFireContext, MessageCause } from '@grotto/api';
import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AutomationFireContextCardView } from './automation-fire-context-card.tsx';
import { MessageCauseHoverContent, MessageCauseMark } from './message-cause-mark.tsx';

test('the header mark names its automation in that automation’s own ink', () => {
    const trigger = render(<MessageCauseMark cause={triggerCause()} />);
    const reminder = render(<MessageCauseMark cause={reminderCause()} />);

    expect(trigger).toContain('Deploy finished');
    expect(trigger).toContain('text-trigger-mark');
    expect(trigger).not.toContain('text-reminder-mark');
    expect(reminder).toContain('Weekly self-review');
    expect(reminder).toContain('text-reminder-mark');
    // Neither borrows a status colour: a fired automation is not a warning.
    expect(trigger + reminder).not.toContain('text-warning');
    expect(trigger + reminder).not.toContain('text-danger');
});

test('the hover card previews the automation and links out to manage it', () => {
    const markup = render(<MessageCauseHoverContent cause={triggerCause()} />);

    expect(markup).toContain('Deploy finished');
    expect(markup).toContain('Webhook');
    expect(markup).toContain('Armed');
    expect(markup).toContain('4m ago');
    expect(markup).toContain('Summarize the deploy in this DM; flag failures.');
    expect(markup).toContain('/s/dev/settings/members/agents/agt_blippy/automations');
});

test('a hover card says when Grotto inferred the link rather than the Agent naming it', () => {
    const inferred = render(
        <MessageCauseHoverContent cause={{ ...triggerCause(), attribution: 'inferred' }} />
    );

    expect(inferred).toContain('Attributed by Grotto');
    // An unqualified mark already means the Agent said so, so an explicit
    // cause carries no note.
    expect(render(<MessageCauseHoverContent cause={triggerCause()} />)).not.toContain(
        'Attributed by Grotto'
    );
});

test('a Reminder hover card trades the fire count for its cadence', () => {
    const markup = render(<MessageCauseHoverContent cause={reminderCause()} />);

    expect(markup).toContain('Cadence');
    expect(markup).toContain('Every Monday at 09:00');
    expect(markup).not.toContain('Fires');
});

test('the Thread context card states the fire and offers its payload', () => {
    const markup = render(<AutomationFireContextCardView context={triggerContext()} />);

    expect(markup).toContain('Deploy finished');
    expect(markup).toContain('of 12');
    expect(markup).toContain('Payload · 52 bytes · application/json');
    expect(markup).toContain('bg-nested-surface');
});

test('a Reminder context card carries its anchoring note and no payload', () => {
    const markup = render(<AutomationFireContextCardView context={reminderContext()} />);

    expect(markup).toContain('Every Monday at 09:00');
    expect(markup).toContain('Anchored on:');
    expect(markup).not.toContain('Payload');
    expect(markup).toContain('/s/dev/settings/members/agents/agt_blippy/automations');
});

/** Rendered where the transcript lives, so the manage link resolves a real slug. */
function render(element: React.ReactElement) {
    return renderToStaticMarkup(
        <MemoryRouter initialEntries={['/s/dev/c/cht_dm']}>
            <Routes>
                <Route element={element} path="/s/:slug/*" />
            </Routes>
        </MemoryRouter>
    );
}

function triggerCause(): MessageCause {
    return {
        attribution: 'explicit',
        automationId: 'trg_deploy',
        fireCount: 12,
        fireId: 'trf_12',
        instruction: 'Summarize the deploy in this DM; flag failures.',
        kind: 'trigger',
        lastFiredAt: relativeMinutesAgo(4),
        ownerAgentId: 'agt_blippy',
        status: 'armed',
        summary: 'Webhook',
        title: 'Deploy finished',
    };
}

function reminderCause(): MessageCause {
    return {
        attribution: 'explicit',
        automationId: 'rem_review',
        fireCount: 6,
        fireId: 'rmf_6',
        instruction: null,
        kind: 'reminder',
        lastFiredAt: '2026-08-27T13:00:00.000Z',
        ownerAgentId: 'agt_blippy',
        status: 'scheduled',
        summary: 'Every Monday at 09:00',
        title: 'Weekly self-review',
    };
}

function triggerContext(): AutomationFireContext {
    return {
        anchorChatId: 'cht_dm',
        anchorExcerpt: null,
        anchorMessageId: null,
        cause: triggerCause(),
        contentType: 'application/json',
        firedAt: relativeMinutesAgo(4),
        fireOrdinal: 12,
        fireTotal: 12,
        nextFireAt: null,
        payload: '{\n  "repo": "grotto"\n}',
        payloadBytes: 52,
        payloadTruncated: false,
        repeat: null,
    };
}

function reminderContext(): AutomationFireContext {
    return {
        anchorChatId: 'cht_dm',
        anchorExcerpt: 'Remind me to write the weekly self-review',
        anchorMessageId: 'msg_anchor',
        cause: reminderCause(),
        contentType: null,
        firedAt: '2026-08-27T13:00:00.000Z',
        fireOrdinal: 6,
        fireTotal: 6,
        nextFireAt: null,
        payload: null,
        payloadBytes: null,
        payloadTruncated: false,
        repeat: 'Every Monday at 09:00',
    };
}

function relativeMinutesAgo(minutes: number) {
    return new Date(Date.now() - minutes * 60_000).toISOString();
}
