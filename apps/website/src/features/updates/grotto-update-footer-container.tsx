import { useNavigate } from 'react-router-dom';
import { serverComputersRoute } from '../servers/server-routes.ts';
import { GrottoUpdateFooter } from './grotto-update-footer.tsx';
import { useGrottoUpdate } from './use-grotto-update.ts';

export function GrottoUpdateFooterContainer({ slug }: { slug: string }) {
    const update = useGrottoUpdate();
    const navigate = useNavigate();
    if (!update.canOperate) {
        return null;
    }
    return (
        <GrottoUpdateFooter
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
