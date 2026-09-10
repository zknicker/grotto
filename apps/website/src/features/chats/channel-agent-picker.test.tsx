import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    addChannelAgentId,
    type ChannelAgentOption,
    ChannelAgentPicker,
    channelAgentOptions,
    channelRosterAgents,
    removeChannelAgentId,
} from './channel-agent-picker.tsx';

const cove = agent('agent_cove', 'Cove');
const iris = agent('agent_iris', 'Iris');
const blippy = agent('agent_blippy', 'Blippy');
const roster = [cove, iris, blippy];

test('offers only the Agents that are not already in the roster', () => {
    expect(channelAgentOptions(roster, ['agent_iris'])).toEqual([cove, blippy]);
    expect(channelAgentOptions(roster, ['agent_cove', 'agent_iris', 'agent_blippy'])).toEqual([]);
});

test('adding appends the Agent and normalizes the ids', () => {
    expect(addChannelAgentId([' agent_cove ', ''], 'agent_iris')).toEqual([
        'agent_cove',
        'agent_iris',
    ]);
    // Adding one that is already there cannot duplicate it.
    expect(addChannelAgentId(['agent_cove'], 'agent_cove')).toEqual(['agent_cove']);
});

test('removing takes only that Agent out', () => {
    expect(removeChannelAgentId(['agent_cove', 'agent_iris'], 'agent_cove')).toEqual([
        'agent_iris',
    ]);
});

test('the roster follows the selection order and skips Agents it cannot name', () => {
    expect(channelRosterAgents(roster, ['agent_blippy', 'agent_gone', 'agent_cove'])).toEqual([
        blippy,
        cove,
    ]);
});

test('each roster row carries its own remove control', () => {
    const markup = renderToStaticMarkup(picker({ selectedAgentIds: ['agent_cove'] }));

    expect(markup).toContain('aria-label="Remove Cove"');
    expect(markup).not.toContain('aria-label="Remove Iris"');
    expect(markup).toContain('Cove');
    // The roster is the selection, not the catalog: unselected Agents live in
    // the popover, which is closed.
    expect(markup).not.toContain('Blippy');
});

test('every roster state is drawn in the same fixed box', () => {
    const states = [
        renderToStaticMarkup(picker({ selectedAgentIds: ['agent_cove'] })),
        renderToStaticMarkup(picker({ selectedAgentIds: [] })),
        renderToStaticMarkup(picker({ agents: [], agentsPending: true, selectedAgentIds: [] })),
    ];

    for (const markup of states) {
        // The box's height is the whole point: filling, emptying, or waiting
        // for the roster must not resize the dialog around it.
        expect(markup).toContain('h-60');
        expect(markup).toContain('md:h-56');
        // And the line under it holds its own height whether or not it speaks.
        expect(markup).toMatch(/<p class="text-muted text-xs"[^>]*>[^<]/);
    }
});

test('an empty roster carries the rule in the box and leaves the line under it quiet', () => {
    const filled = renderToStaticMarkup(picker({ selectedAgentIds: ['agent_cove'] }));
    const empty = renderToStaticMarkup(picker({ selectedAgentIds: [] }));

    expect(filled).toContain(rule);
    expect(filled).not.toContain('No agents yet');

    expect(empty).toContain('No agents yet');
    expect(empty).toContain(`${rule} Add one above.`);
    // One fact, one place: the box asks for the Agent, so the hint line has
    // nothing left to say and nothing to say it in red.
    expect(occurrences(empty, rule)).toBe(1);
    expect(empty).not.toContain('text-danger');
    expect(empty).not.toContain('Choose at least one Agent.');
    // The quiet line is still a line: a no-break space holds the slot open.
    expect(empty).toContain('>\u00A0</p>');
});

test('the group is described by the rule in either roster state', () => {
    for (const markup of [
        renderToStaticMarkup(picker({ selectedAgentIds: ['agent_cove'] })),
        renderToStaticMarkup(picker({ selectedAgentIds: [] })),
    ]) {
        expect(describedText(markup)).toContain(rule);
    }
});

test('a Server with no Agents says so instead of asking for one it cannot offer', () => {
    const markup = renderToStaticMarkup(picker({ agents: [], selectedAgentIds: [] }));

    expect(markup).toContain('No agents available.');
    expect(markup).not.toContain('Add one above.');
});

test('a hidden label names the group without drawing it', () => {
    const hidden = renderToStaticMarkup(picker({ label: 'hidden' }));
    const visible = renderToStaticMarkup(picker({ label: 'visible' }));

    expect(hidden).toContain('aria-label="Agents"');
    expect(hidden).not.toContain('<label');
    expect(visible).toContain('<label');
    expect(visible).toContain('aria-labelledby=');
    expect(visible).not.toContain('aria-label="Agents"');
});

test('a pending Agents list waits instead of claiming the roster is empty', () => {
    const markup = renderToStaticMarkup(
        picker({ agents: [], agentsPending: true, selectedAgentIds: [] })
    );

    expect(markup).toContain('Loading agents');
    expect(markup).not.toContain('No agents yet');
    expect(markup).toContain(rule);
});

const rule = 'A channel keeps at least one Agent.';

function agent(id: string, name: string): ChannelAgentOption {
    return { avatarUrl: null, id, name };
}

/** The text of whatever the group points `aria-describedby` at. */
function describedText(markup: string) {
    const described = markup.match(/aria-describedby="([^"]+)"/);
    if (described === null) {
        throw new Error('the group describes itself with nothing');
    }
    const target = markup.match(new RegExp(`id="${described[1]}"[^>]*>([^<]*)<`));
    if (target === null) {
        throw new Error(`nothing carries id ${described[1]}`);
    }
    return target[1];
}

function occurrences(markup: string, text: string) {
    return markup.split(text).length - 1;
}

function picker(overrides: Partial<Parameters<typeof ChannelAgentPicker>[0]> = {}) {
    return (
        <ChannelAgentPicker
            agents={roster}
            agentsPending={false}
            isDisabled={false}
            label="hidden"
            onSelectedAgentIdsChange={() => undefined}
            selectedAgentIds={['agent_cove']}
            {...overrides}
        />
    );
}
