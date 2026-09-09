import { expect, test } from 'bun:test';
import {
    agentPeekActivityTitle,
    formatAutomationsSummary,
    formatExecutionDetail,
    formatPeekChatLabel,
    summarizeAgentNames,
    summarizeAgentSkills,
} from './agent-peek-model.ts';

test('heads the activity section Now only while a turn is running', () => {
    expect(agentPeekActivityTitle({ phase: 'started' })).toBe('Now');
    expect(agentPeekActivityTitle({ phase: 'completed' })).toBe('Recent activity');
    expect(agentPeekActivityTitle({ phase: 'interrupted' })).toBe('Recent activity');
    expect(agentPeekActivityTitle(null)).toBe('Recent activity');
});

test('states the runtime and model on one line, or why it cannot', () => {
    expect(
        formatExecutionDetail({ kind: 'effective', model: 'Opus 4.6', runtime: 'Claude Code' })
    ).toBe('Claude Code · Opus 4.6');
    expect(formatExecutionDetail({ kind: 'unavailable', label: 'Configuration pending' })).toBe(
        'Configuration pending'
    );
});

test('summarizes automations without printing an empty kind', () => {
    expect(formatAutomationsSummary({ reminders: 2, triggers: 1 })).toBe('2 reminders · 1 trigger');
    expect(formatAutomationsSummary({ reminders: 1, triggers: 0 })).toBe('1 reminder');
    expect(formatAutomationsSummary({ reminders: 0, triggers: 3 })).toBe('3 triggers');
    expect(formatAutomationsSummary({ reminders: 0, triggers: 0 })).toBe('No automations');
});

test('names a Channel by its name and a DM by what it is', () => {
    expect(formatPeekChatLabel({ name: '#product' }, 'blippy')).toBe('#product');
    expect(formatPeekChatLabel({ name: null }, 'blippy')).toBe('DM · @blippy');
});

test('orders and deduplicates a chip row, and says once when it is empty', () => {
    expect(summarizeAgentNames(['linear', 'Axiom', 'linear'], 'No connections yet.')).toEqual({
        kind: 'names',
        names: ['Axiom', 'linear'],
    });
    expect(summarizeAgentNames([], 'No connections yet.')).toEqual({
        kind: 'empty',
        label: 'No connections yet.',
    });
});

test('separates an unreported Computer from an Agent with no skills', () => {
    expect(summarizeAgentSkills({ names: [], reported: false })).toEqual({
        kind: 'empty',
        label: 'Unavailable while the Computer is offline.',
    });
    expect(summarizeAgentSkills({ names: [], reported: true })).toEqual({
        kind: 'empty',
        label: 'No skills yet.',
    });
    expect(summarizeAgentSkills({ names: ['Visuals'], reported: true })).toEqual({
        kind: 'names',
        names: ['Visuals'],
    });
});
