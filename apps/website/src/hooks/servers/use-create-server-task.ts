import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useCreateServerTask() {
    return grottoTrpc.task.create.useMutation();
}
