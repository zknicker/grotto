import { hausTrpc } from '../../lib/haus-server.tsx';

export function useTaskLabelCreate() {
    return hausTrpc.taskLabel.create.useMutation();
}
