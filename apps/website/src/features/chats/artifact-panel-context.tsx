import * as React from 'react';
import { bindWorkspaceTargetToAgent, type TavernResourceTarget } from './tavern-resource-link.ts';

const ArtifactPanelContext = React.createContext<((target: TavernResourceTarget) => void) | null>(
    null
);

export function ArtifactPanelOpenProvider({
    agentId,
    children,
    onOpen,
}: {
    agentId?: string;
    children: React.ReactNode;
    onOpen: (target: TavernResourceTarget) => void;
}) {
    const open = React.useCallback(
        (target: TavernResourceTarget) => onOpen(bindWorkspaceTargetToAgent(target, agentId)),
        [agentId, onOpen]
    );
    return <ArtifactPanelContext.Provider value={open}>{children}</ArtifactPanelContext.Provider>;
}

export function useArtifactPanelOpen() {
    return React.useContext(ArtifactPanelContext);
}
