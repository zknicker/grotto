import { hausTrpc } from '../../lib/haus-server.tsx';

export function useTaskCreate() {
    return hausTrpc.task.create.useMutation();
}
