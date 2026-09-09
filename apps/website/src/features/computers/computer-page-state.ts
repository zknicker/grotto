import type { GrottoOutputs } from '../../lib/grotto-server.tsx';

type Computer = GrottoOutputs['computer']['list'][number];

export type ComputerPageState =
    | { status: 'loading' }
    | { status: 'empty' }
    | { requestedId: string; status: 'not-found' }
    | { computerId: string; status: 'ready' };

export function resolveComputerPageState(input: {
    computers: Computer[] | undefined;
    requestedId: string | null;
}): ComputerPageState {
    if (!input.computers) {
        return { status: 'loading' };
    }

    const items = input.computers;
    if (input.requestedId !== null) {
        return items.some((computer) => computer.id === input.requestedId)
            ? { computerId: input.requestedId, status: 'ready' }
            : { requestedId: input.requestedId, status: 'not-found' };
    }

    const computerId = items[0]?.id;

    return computerId ? { computerId, status: 'ready' } : { status: 'empty' };
}
