import { hausTrpc } from '../../lib/haus-server.tsx';

export function useTaskLabelUpdate() {
    return hausTrpc.taskLabel.update.useMutation();
}
