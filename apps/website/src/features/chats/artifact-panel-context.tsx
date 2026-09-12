import * as React from 'react';
import { bindWorkspaceTargetToAgent, type HausResourceTarget } from './haus-resource-link.ts';

const ArtifactPanelContext = React.createContext<((target: HausResourceTarget) => void) | null>(
    null
);

export function ArtifactPanelOpenProvider({
    agentId,
    children,
    onOpen,
}: {
    agentId?: string;
    children: React.ReactNode;
    onOpen: (target: HausResourceTarget) => void;
}) {
    const open = React.useCallback(
        (target: HausResourceTarget) => onOpen(bindWorkspaceTargetToAgent(target, agentId)),
        [agentId, onOpen]
    );
    return <ArtifactPanelContext.Provider value={open}>{children}</ArtifactPanelContext.Provider>;
}

export function useArtifactPanelOpen() {
    return React.useContext(ArtifactPanelContext);
}
