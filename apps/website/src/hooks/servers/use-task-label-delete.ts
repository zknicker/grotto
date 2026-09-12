import { hausTrpc } from '../../lib/haus-server.tsx';

export function useTaskLabelDelete() {
    return hausTrpc.taskLabel.delete.useMutation();
}
