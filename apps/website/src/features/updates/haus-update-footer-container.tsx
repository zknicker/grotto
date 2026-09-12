import { useNavigate } from 'react-router-dom';
import { serverComputersRoute } from '../servers/server-routes.ts';
import { HausUpdateFooter } from './haus-update-footer.tsx';
import { useHausUpdate } from './use-haus-update.ts';

export function HausUpdateFooterContainer({ slug }: { slug: string }) {
    const update = useHausUpdate();
    const navigate = useNavigate();
    if (!update.canOperate) {
        return null;
    }
    return (
        <HausUpdateFooter
            isRunning={update.isRunning}
            offlineComputers={update.offlineComputers}
            onAction={() => {
                void update.run();
            }}
            onOpenComputer={(computerId) => {
                navigate(
                    `${serverComputersRoute(slug)}?computer=${encodeURIComponent(computerId)}`
                );
            }}
            view={update.view}
        />
    );
}
