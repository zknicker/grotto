import { GrottoUpdateFooter } from './grotto-update-footer.tsx';
import { useGrottoUpdate } from './use-grotto-update.ts';

export function GrottoUpdateFooterContainer() {
    const update = useGrottoUpdate();
    return (
        <GrottoUpdateFooter
            onAction={() => {
                void update.run();
            }}
            view={update.view}
        />
    );
}
