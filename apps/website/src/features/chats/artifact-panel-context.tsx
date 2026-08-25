import * as React from 'react';
import { bindWorkspaceTargetToAgent, type GrottoResourceTarget } from './grotto-resource-link.ts';

const ArtifactPanelContext = React.createContext<((target: GrottoResourceTarget) => void) | null>(
    null
);

export function ArtifactPanelOpenProvider({
    agentId,
    children,
    onOpen,
}: {
    agentId?: string;
    children: React.ReactNode;
    onOpen: (target: GrottoResourceTarget) => void;
}) {
    const open = React.useCallback(
        (target: GrottoResourceTarget) => onOpen(bindWorkspaceTargetToAgent(target, agentId)),
        [agentId, onOpen]
    );
    return <ArtifactPanelContext.Provider value={open}>{children}</ArtifactPanelContext.Provider>;
}

export function useArtifactPanelOpen() {
    return React.useContext(ArtifactPanelContext);
}
