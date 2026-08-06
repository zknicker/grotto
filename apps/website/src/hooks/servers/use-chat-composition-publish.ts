import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useChatCompositionPublish() {
    return grottoTrpc.chat.publishComposition.useMutation();
}
