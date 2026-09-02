import { expect, test } from 'bun:test';
import type { AgentCreatePreparedAction, PreparedAction } from '@grotto/api';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveAgentCreateCardVisibility } from './agent-create-action-card.tsx';
import { PreparedActionCard, preparedActionMessageText } from './prepared-action-card.tsx';

/**
 * The card is composed from named parts, so the structural assertions are
 * about which part holds what: the chip inside the status slot, itself
 * inside the title slot right after the name, the controls in their own row
 * at the bottom. A part with no content is omitted, so `hasSlot` reads false
 * rather than matching an empty element.
 */
function hasSlot(markup: string, slot: string): boolean {
    return markup.includes(`data-slot="${slot}"`);
}

/** The markup of one slot's own element, so "contains" means "is inside it". */
function slotHtml(markup: string, slot: string): string {
    const attribute = markup.indexOf(`data-slot="${slot}"`);
    if (attribute < 0) {
        throw new Error(`no data-slot="${slot}" in markup`);
    }
    const start = markup.lastIndexOf('<div', attribute);
    let depth = 0;
    for (let index = start; index < markup.length; index++) {
        if (markup.startsWith('<div', index)) {
            depth++;
        } else if (markup.startsWith('</div>', index)) {
            depth--;
            if (depth === 0) {
                return markup.slice(start, index + '</div>'.length);
            }
        }
    }
    throw new Error(`unbalanced markup for data-slot="${slot}"`);
}

const pendingAction: AgentCreatePreparedAction = {
    chatId: 'cht_product',
    createdAt: '2026-08-25T12:00:00.000Z',
    executedAt: null,
    executedByUserId: null,
    id: 'act_1234567890abcdef',
    kind: 'agent:create',
    messageId: 'msg_1234567890abcdef',
    proposerAgentId: 'agt_builder',
    proposal: {
        avatar: {
            byteSize: 8,
            id: 'pam_1234567890abcdef',
            mediaType: 'image/png',
            sha256: 'a'.repeat(64),
            url: '/api/prepared-action-media/pam_1234567890abcdef',
        },
        computer: { computerId: 'cmp_local', kind: 'suggested', label: 'Desk Mac' },
        description: 'Keeps the release tidy.',
        draftHint: 'Start with release notes and small fixes.',
        kind: 'agent:create',
        name: 'Orbit',
    },
    status: 'pending',
    supersededAt: null,
    supersededByActionId: null,
};

const executedAction: AgentCreatePreparedAction = {
    ...pendingAction,
    executedAt: '2026-08-25T12:01:00.000Z',
    executedByUserId: 'usr_owner',
    result: {
        agentId: 'agt_orbit',
        avatarUrl: '/api/avatars/agt_orbit',
        computerId: 'cmp_local',
        description: 'Keeps the release tidy.',
        displayName: 'Orbit',
        handle: 'orbit',
        modelId: 'gpt-5-codex',
        reasoningEffort: 'medium',
        role: 'member',
        runtimeId: 'codex',
    },
    status: 'executed',
};

const supersededAction: AgentCreatePreparedAction = {
    ...pendingAction,
    status: 'superseded',
    supersededAt: '2026-08-25T12:01:00.000Z',
    supersededByActionId: 'act_fedcba0987654321',
};

test('a pending proposal without manage rights names the Agent and offers no control', () => {
    const markup = renderToStaticMarkup(<PreparedActionCard action={pendingAction} />);

    expect(markup).toContain('data-action-kind="agent:create"');
    expect(markup).toContain('data-action-status="pending"');
    expect(markup).toContain('Orbit');
    // The description under the title is the proposal's own text, not
    // prefixed with the kind — the reader already knows it's a proposal.
    expect(slotHtml(markup, 'description')).toContain('Keeps the release tidy.');
    expect(slotHtml(markup, 'description')).not.toContain('Agent proposal');
    // The Create Agent modal owns the committed and human-owned fields.
    expect(markup).not.toContain('Runs on');
    expect(markup).not.toContain('Desk Mac');
    expect(markup).not.toContain('Member');
    // The proposer's note is the message above the card, never a quote in it.
    expect(markup).not.toContain('Start with release notes and small fixes.');
    // A pending card asks by existing; it carries no status chip in the
    // title, so there's no "Created" text at all.
    expect(markup).not.toContain('Needs you');
    expect(markup).not.toContain('Created');
    // Nothing to press without manage rights, so no bottom row either.
    expect(markup).not.toContain('<button');
    expect(hasSlot(markup, 'actions')).toBe(false);
    // A chat object, not a thread preview: bordered card at a capped measure,
    // never a full-width nested surface.
    expect(markup).toContain('border-separator');
    expect(markup).toContain('max-w-[36rem]');
    expect(markup).not.toContain('bg-nested-surface');
});

test('a proposal with no description omits the description part rather than a bare label', () => {
    const markup = renderToStaticMarkup(
        <PreparedActionCard
            action={{ ...pendingAction, proposal: { ...pendingAction.proposal, description: '' } }}
        />
    );

    expect(hasSlot(markup, 'description')).toBe(false);
});

test('lets a current admin create the Agent with a real button, and the card carries no chip', () => {
    const markup = renderToStaticMarkup(
        <PreparedActionCard action={pendingAction} canManage serverId="srv_1234567890abcdef" />
    );

    expect(markup).toContain('data-action-status="pending"');
    expect(markup).not.toContain('Needs you');
    expect(markup).not.toContain('Created');
    // The control lives in the card's own bottom row, not beside the title.
    expect(slotHtml(markup, 'actions')).toContain('Create Agent');
    expect(slotHtml(markup, 'actions')).toContain('<button');
    expect(slotHtml(markup, 'header')).not.toContain('<button');
});

test('a created card names the committing human, shows Created, and offers the new Agent', () => {
    const markup = renderToStaticMarkup(
        <PreparedActionCard action={executedAction} executedByDisplayName="Owner" />
    );

    expect(markup).toContain('data-action-status="executed"');
    expect(slotHtml(markup, 'description')).toContain('Keeps the release tidy.');
    expect(slotHtml(markup, 'description')).not.toContain('Agent proposal');
    // The receipt sits inside the bottom row, at its right end, after the
    // buttons — not its own meta row.
    expect(slotHtml(markup, 'actions')).toContain('data-slot="receipt"');
    expect(slotHtml(markup, 'actions')).toContain('Created by Owner');
    expect(hasSlot(markup, 'meta')).toBe(false);
    // The chip sits inside the status slot, itself inside the title slot
    // right after the name; the control sits in the bottom row.
    expect(slotHtml(markup, 'title')).toContain('Orbit');
    expect(slotHtml(markup, 'title')).toContain('data-slot="status"');
    expect(slotHtml(markup, 'title')).toContain('Created');
    expect(slotHtml(markup, 'actions')).toContain('Open');
    expect(slotHtml(markup, 'actions')).toContain('<button');
    expect(slotHtml(markup, 'header')).not.toContain('<button');
    // Execution values belong to the Agent profile, not to a transcript row.
    expect(markup).not.toContain('Model');
    expect(markup).not.toContain('gpt-5-codex');
    expect(markup).not.toContain('Desk Mac');
});

test('a superseded proposal renders no card at all', () => {
    const markup = renderToStaticMarkup(
        <PreparedActionCard action={supersededAction} canManage serverId="srv_1234567890abcdef" />
    );

    expect(markup).not.toContain('<article');
    expect(markup).not.toContain('<button');
});

test('a card that goes superseded live animates out; one already superseded never appears', () => {
    // Pending, unaffected by any of this: stays live.
    expect(
        resolveAgentCreateCardVisibility({ hidden: false, status: 'pending', wasVisible: true })
    ).toBe('live');
    // Was on screen, just went superseded: collapse it out.
    expect(
        resolveAgentCreateCardVisibility({ hidden: false, status: 'superseded', wasVisible: true })
    ).toBe('exiting');
    // Arrived already superseded: never shown, never animated.
    expect(
        resolveAgentCreateCardVisibility({ hidden: false, status: 'superseded', wasVisible: false })
    ).toBe('hidden');
    // The collapse finished (`onExited` fired, e.g. from a `transitionend` on
    // the exit wrapper or its fallback timer): gone for good regardless of
    // how `wasVisible` reads.
    expect(
        resolveAgentCreateCardVisibility({ hidden: true, status: 'superseded', wasVisible: true })
    ).toBe('hidden');
});

test('the anchor message reads as the proposer’s note when the Server body is empty', () => {
    expect(preparedActionMessageText({ content: '', preparedAction: pendingAction })).toBe(
        'Start with release notes and small fixes.'
    );
    expect(
        preparedActionMessageText({ content: 'Here is Orbit.', preparedAction: pendingAction })
    ).toBe('Here is Orbit.');
    expect(
        preparedActionMessageText({
            content: '',
            preparedAction: {
                ...pendingAction,
                proposal: { ...pendingAction.proposal, draftHint: null },
            },
        })
    ).toBe('');
    expect(
        preparedActionMessageText({
            content: '',
            preparedAction: {
                ...supersededAction,
                proposal: { ...supersededAction.proposal, draftHint: null },
            },
        })
    ).toBe('Earlier proposal, replaced.');
    expect(preparedActionMessageText({ content: 'Plain message.' })).toBe('Plain message.');
});

test('unknown action kinds are inert fallback cards', () => {
    const action = {
        ...pendingAction,
        kind: 'channel:create',
        proposal: { name: 'General' },
    } as unknown as PreparedAction;
    const markup = renderToStaticMarkup(<PreparedActionCard action={action} />);

    expect(markup).toContain('Unsupported action · Not available in this version of Grotto');
    expect(markup).toContain('data-action-kind="channel:create"');
    expect(markup).not.toContain('<button');
    // Nothing to report and nothing to press: the title holds only the
    // truncated kind text, no chip beside it, and the actions row is left
    // out entirely.
    expect(slotHtml(markup, 'title')).toContain(
        '<span class="min-w-0 truncate">channel:create</span>'
    );
    expect(slotHtml(markup, 'title')).not.toContain('data-slot="chip"');
    expect(hasSlot(markup, 'actions')).toBe(false);
});
