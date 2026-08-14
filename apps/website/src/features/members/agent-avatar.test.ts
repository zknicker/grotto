import { expect, test } from 'bun:test';
import { badgeVariants } from '@heroui/styles';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentAvatar, availabilityBadgeColor, availabilityLabel } from './agent-avatar.tsx';

test('DM status copy uses concise global availability labels', () => {
    expect(availabilityLabel('idle')).toBe('Online');
    expect(availabilityLabel('working')).toBe('Working');
    expect(availabilityLabel('offline')).toBe('Offline');
    expect(availabilityLabel('stopped')).toBe('Stopped');
    expect(availabilityLabel('error')).toBe('Needs attention');
});

test('availability maps onto HeroUI Badge colors', () => {
    expect(availabilityBadgeColor('idle')).toBe('success');
    expect(availabilityBadgeColor('working')).toBe('warning');
    expect(availabilityBadgeColor('error')).toBe('danger');
    expect(availabilityBadgeColor('offline')).toBe('default');
});

test('HeroUI Badge variants remain isolated between Agent instances', () => {
    const idleBadge = badgeVariants({ color: 'success', placement: 'bottom-right', size: 'sm' });
    const workingBadge = badgeVariants({ color: 'warning', placement: 'bottom-right', size: 'sm' });

    expect(idleBadge).not.toBe(workingBadge);
    expect(idleBadge.base()).toContain('badge--success');
    expect(idleBadge.base()).not.toContain('badge--warning');
    expect(workingBadge.base()).toContain('badge--warning');
});

test('AgentAvatar renders the required availability with the matching badge color', () => {
    const markup = renderToStaticMarkup(
        AgentAvatar({
            agent: {
                availability: 'idle',
                avatarUrl: null,
                displayName: 'Blippy',
                id: 'agt_blippy',
            },
            size: 24,
        })
    );

    expect(markup).toContain('data-agent-status="idle"');
    expect(markup).toContain('badge--success');
    expect(markup).not.toContain('badge--warning');
    expect(markup).not.toContain('data-agent-status="unknown"');
});

test('offline AgentAvatar uses the stronger muted fill on every surface', () => {
    const markup = renderToStaticMarkup(
        AgentAvatar({
            agent: {
                availability: 'offline',
                avatarUrl: null,
                displayName: 'Blippy',
                id: 'agt_blippy',
            },
            size: 24,
        })
    );

    expect(markup).toContain('data-agent-status="offline"');
    expect(markup).toContain('badge--default');
    expect(markup).toContain('bg-muted');
});
