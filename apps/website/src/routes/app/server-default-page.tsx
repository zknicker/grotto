import { Navigate } from 'react-router-dom';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { serverActivityRoute } from '../../features/servers/server-routes.ts';

export function ServerDefaultPage() {
    const { server } = useHostedServerContext();
    return <Navigate replace to={serverActivityRoute(server.slug)} />;
}
