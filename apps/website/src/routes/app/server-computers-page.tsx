import { useParams } from 'react-router-dom';
import { ComputerPage } from '../../features/computers/computer-page.tsx';
import { RequireOperator } from '../../features/servers/require-operator.tsx';
import { useServerContext } from '../../features/servers/server-context.ts';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

/** Server-owned Computer inventory backed by persisted reports and the live attachment socket. */
export function ServerComputersPage() {
    const { slug = '' } = useParams();
    const { server } = useServerContext();
    useWindowTitle('Computers');

    return (
        <RequireOperator
            description="Computers are attached and removed by Server operators."
            role={server.role}
        >
            <ComputerPage serverId={server.id} serverSlug={slug} />
        </RequireOperator>
    );
}
