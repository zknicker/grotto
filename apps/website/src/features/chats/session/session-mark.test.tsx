import { expect, test } from 'bun:test';
import type { AgentSessionRotation } from '@grotto/api';
import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MessageSessionMark, SessionMarkHoverContent } from './message-session-mark.tsx';

test('the mark names a new session in its own ink', () => {
    const markup = render(
        <MessageSessionMark agentId="agt_blippy" generation={5} serverId="srv_1" />
    );

    expect(markup).toContain('New session');
    expect(markup).toContain('text-session-mark');
    // Not a status: an Agent that restarted is not an Agent that failed.
    expect(markup).not.toContain('text-warning');
    expect(markup).not.toContain('text-danger');
});

test('the hover card states why, when, and what the restart replaced', () => {
    const markup = render(<SessionMarkHoverContent agentId="agt_blippy" rotation={rotation()} />);

    expect(markup).toContain('New session');
    expect(markup).toContain('Settings changed');
    expect(markup).toContain('Previous session');
    expect(markup).toContain('3h');
    expect(markup).toContain('/s/dev/settings/members/agents/agt_blippy/activity');
});

test('the hover card says only what it knows while the rotation is unread', () => {
    const markup = render(<SessionMarkHoverContent agentId="agt_blippy" rotation={null} />);

    expect(markup).toContain('New session');
    // No shell of empty rows: the labels arrive with their values or not at all.
    expect(markup).not.toContain('Reason');
    expect(markup).not.toContain('Previous session');
    expect(markup).toContain('/s/dev/settings/members/agents/agt_blippy/activity');
});

/** Rendered where the transcript lives, so the activity link resolves a real slug. */
function render(element: React.ReactElement) {
    return renderToStaticMarkup(
        <MemoryRouter initialEntries={['/s/dev/c/cht_dm']}>
            <Routes>
                <Route element={element} path="/s/:slug/*" />
            </Routes>
        </MemoryRouter>
    );
}

function rotation(): AgentSessionRotation {
    return {
        generation: 5,
        previousDurationMs: 3 * 3_600_000,
        reason: 'configuration',
        rotatedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    };
}
