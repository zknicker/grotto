import type { GrottoResourceTarget } from './grotto-resource-link.ts';

export interface ChatArtifactPanelState {
    activeKey: string | null;
    closeActiveTarget: () => void;
    closeTarget: (key: string) => void;
    open: (target: GrottoResourceTarget) => void;
    setActiveKey: (key: string) => void;
    targets: GrottoResourceTarget[];
    toggleVisible: () => void;
    visible: boolean;
}
