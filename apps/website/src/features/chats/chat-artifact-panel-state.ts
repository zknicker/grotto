import type { TavernResourceTarget } from './tavern-resource-link.ts';

export interface ChatArtifactPanelState {
    activeKey: string | null;
    closeActiveTarget: () => void;
    closeTarget: (key: string) => void;
    open: (target: TavernResourceTarget) => void;
    setActiveKey: (key: string) => void;
    targets: TavernResourceTarget[];
    toggleVisible: () => void;
    visible: boolean;
}
