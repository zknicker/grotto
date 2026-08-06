import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useTaskLabelDelete() {
    return grottoTrpc.taskLabel.delete.useMutation();
}
