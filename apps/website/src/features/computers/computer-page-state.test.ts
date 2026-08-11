import { expect, test } from 'bun:test';
import type { GrottoOutputs } from '../../lib/grotto-server.tsx';
import { resolveComputerPageState } from './computer-page-state.ts';

type Computer = GrottoOutputs['computer']['list'][number];

test('does not present the attach flow before the Computer list resolves', () => {
    expect(resolveComputerPageState({ computers: undefined, requestedId: null })).toEqual({
        status: 'loading',
    });
});

test('presents the attach flow only for a settled empty list', () => {
    expect(resolveComputerPageState({ computers: [], requestedId: null })).toEqual({
        status: 'empty',
    });
});

test('selects the requested Computer or falls back to the first one', () => {
    const computers = [{ id: 'computer-1' }, { id: 'computer-2' }] as Computer[];

    expect(resolveComputerPageState({ computers, requestedId: 'computer-2' })).toEqual({
        computerId: 'computer-2',
        status: 'ready',
    });
    expect(resolveComputerPageState({ computers, requestedId: 'missing' })).toEqual({
        computerId: 'computer-1',
        status: 'ready',
    });
});
