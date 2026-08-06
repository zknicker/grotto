import { useOutletContext } from 'react-router-dom';
import type { ServerDetail } from '../../lib/grotto-server.tsx';

export interface HostedServerContextValue {
    server: ServerDetail;
}

export function useHostedServerContext() {
    return useOutletContext<HostedServerContextValue>();
}
