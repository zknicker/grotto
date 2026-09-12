import { hausTrpc } from '../../lib/haus-server.tsx';

export function useChatCompositionPublish() {
    return hausTrpc.chat.publishComposition.useMutation();
}
