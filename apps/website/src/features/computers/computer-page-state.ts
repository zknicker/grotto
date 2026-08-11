import type { GrottoOutputs } from '../../lib/grotto-server.tsx';

type Computer = GrottoOutputs['computer']['list'][number];

export type ComputerPageState =
    | { status: 'loading' }
    | { status: 'empty' }
    | { computerId: string; status: 'ready' };

export function resolveComputerPageState(input: {
    computers: Computer[] | undefined;
    requestedId: string | null;
}): ComputerPageState {
    if (!input.computers) {
        return { status: 'loading' };
    }

    const items = input.computers;
    const computerId =
        items.find((computer) => computer.id === input.requestedId)?.id ?? items[0]?.id;

    return computerId ? { computerId, status: 'ready' } : { status: 'empty' };
}
