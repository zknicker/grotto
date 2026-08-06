import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useTaskLabelCreate() {
    return grottoTrpc.taskLabel.create.useMutation();
}
