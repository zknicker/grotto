import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useDeleteServerTaskLabel() {
    return grottoTrpc.taskLabel.delete.useMutation();
}
