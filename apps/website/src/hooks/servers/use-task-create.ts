import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useTaskCreate() {
    return grottoTrpc.task.create.useMutation();
}
