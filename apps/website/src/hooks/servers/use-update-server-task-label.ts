import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useUpdateServerTaskLabel() {
    return grottoTrpc.taskLabel.update.useMutation();
}
