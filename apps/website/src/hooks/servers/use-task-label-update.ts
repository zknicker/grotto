import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useTaskLabelUpdate() {
    return grottoTrpc.taskLabel.update.useMutation();
}
