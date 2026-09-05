import { expect, test } from 'bun:test';
import { askStatusText } from './ask-presentation.ts';

test('an open Ask states only that it is open', () => {
    expect(askStatusText({ answeredByName: 'Cove', status: 'open' })).toBe('Open');
});

test('a settled Ask names who answered it', () => {
    expect(askStatusText({ answeredByName: 'Blippy', status: 'answered' })).toBe(
        'Answered by Blippy'
    );
});

test('a settled Ask whose author no longer resolves stays honest', () => {
    expect(askStatusText({ answeredByName: null, status: 'answered' })).toBe('Answered by Unknown');
});
