import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useConnectionOauthStart() {
    return grottoTrpc.mcp.startOAuth.useMutation();
}
