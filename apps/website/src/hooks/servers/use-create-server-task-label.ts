import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useCreateServerTaskLabel() {
    return grottoTrpc.taskLabel.create.useMutation();
}
