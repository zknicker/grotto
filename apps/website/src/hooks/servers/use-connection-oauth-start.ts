import { hausTrpc } from '../../lib/haus-server.tsx';

export function useConnectionOauthStart() {
    return hausTrpc.mcp.startOAuth.useMutation();
}
