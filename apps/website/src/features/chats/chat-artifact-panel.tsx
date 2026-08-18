import { File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { useDesktopTabPane } from '../../hooks/desktop/use-desktop-window-commands.ts';
import { ArtifactPanelChrome } from './chat-artifact-panel-chrome.tsx';
import type { ChatArtifactPanelState } from './chat-artifact-panel-state.ts';
import { WorkspaceBrowserContent } from './chat-artifact-workspace-content.tsx';
import { ChatSidePaneShell } from './chat-side-pane-shell.tsx';
import {
    getArtifactPanelTargetKey,
    isWorkspaceChatPaneTarget,
    type TavernResourceTarget,
} from './tavern-resource-link.ts';

export function ChatArtifactPanel({
    agentId,
    open = true,
    serverId,
    state,
    takeover = false,
}: {
    agentId: string;
    open?: boolean;
    serverId: string;
    state: ChatArtifactPanelState;
    takeover?: boolean;
}) {
    // ⌘W closes the active tab, then the pane, and only then the window;
    // ⌘T opens the workspace tab while the pane is visible.
    useDesktopTabPane({
        active: open && state.visible,
        closeActiveTab: () => {
            if (state.activeKey) {
                state.closeActiveTarget();
            } else {
                state.toggleVisible();
            }
            return true;
        },
        openNewTab: () => {
            if (!agentId) {
                return false;
            }

            state.open({ agentId, kind: 'workspaceDirectory', path: '' });
            return true;
        },
    });

    return (
        <ChatSidePaneShell label="Artifacts" open={open && state.visible} takeover={takeover}>
            {(width) => (
                <ArtifactPanelBody
                    agentId={agentId}
                    serverId={serverId}
                    state={state}
                    width={width ?? undefined}
                />
            )}
        </ChatSidePaneShell>
    );
}

// The pane renders only the active target's content; tab selection is
// controlled state so the chrome and body stay in one Tabs root.
function ArtifactPanelBody({
    agentId,
    serverId,
    state,
    width,
}: {
    agentId: string;
    serverId: string;
    state: ChatArtifactPanelState;
    width?: number;
}) {
    const activeTarget = state.targets.find(
        (target) => getArtifactPanelTargetKey(target) === state.activeKey
    );
    const activeAgentId =
        activeTarget && 'agentId' in activeTarget ? (activeTarget.agentId ?? agentId) : agentId;

    return (
        <div
            className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
            style={width ? { width } : undefined}
        >
            <header
                className="relative z-40 flex h-12 shrink-0 items-center border-separator border-b bg-background"
                data-window-drag-region=""
            >
                <ArtifactPanelChrome
                    activeKey={state.activeKey}
                    activeTarget={activeTarget}
                    agentId={activeAgentId}
                    onClose={state.toggleVisible}
                    onCloseTarget={state.closeTarget}
                    onOpenTarget={state.open}
                    onSelectTarget={state.setActiveKey}
                    targets={state.targets}
                />
            </header>
            <div className="min-h-0 flex-1">
                {activeTarget ? (
                    <ArtifactPanelContent
                        agentId={activeAgentId}
                        // Workspace targets share one tab whose file selection
                        // morphs the target; a stable key keeps the browser
                        // (tree state, loaded folders) mounted across morphs.
                        key={
                            isWorkspaceChatPaneTarget(activeTarget)
                                ? `workspace:${activeAgentId}`
                                : state.activeKey
                        }
                        onOpenTarget={state.open}
                        serverId={serverId}
                        target={activeTarget}
                    />
                ) : (
                    <ArtifactPanelEmpty
                        detail="Open a workspace file from the + menu, or click a linked output in chat."
                        title="No artifacts open"
                    />
                )}
            </div>
        </div>
    );
}

function ArtifactPanelContent({
    agentId,
    onOpenTarget,
    serverId,
    target,
}: {
    agentId: string;
    onOpenTarget: (target: TavernResourceTarget) => void;
    serverId: string;
    target: TavernResourceTarget;
}) {
    // Stable identity: browser effects key on this callback.
    const openWorkspaceFile = React.useCallback(
        (path: null | string) => {
            if (path) {
                onOpenTarget({
                    agentId: 'agentId' in target ? (target.agentId ?? agentId) : agentId,
                    kind: 'workspaceFile',
                    path,
                });
            }
        },
        [agentId, onOpenTarget, target]
    );

    // The workspace is one unified tab: file content plus the workspace tree.
    // Picking a file in the tree morphs this tab's target in place, so the
    // tab title follows the open file.
    return (
        <WorkspaceBrowserContent
            agentId={agentId}
            initialDirectoryPath={workspaceInitialDirectory(target)}
            onSelectPath={openWorkspaceFile}
            selectedPath={target.kind === 'workspaceFile' ? target.path : null}
            serverId={serverId}
        />
    );
}

function workspaceInitialDirectory(target: TavernResourceTarget) {
    if (target.kind === 'workspaceFile') {
        return target.path.split('/').slice(0, -1).join('/');
    }
    return target.path;
}

function ArtifactPanelEmpty({ detail, title }: { detail: string; title: string }) {
    return (
        <div className="grid h-full min-h-0 place-items-center px-8 text-center">
            <div className="max-w-sm">
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border border-separator bg-surface-secondary">
                    <Icon className="size-4 text-muted" icon={File01Icon} />
                </div>
                <div className="truncate font-medium text-sm">{title}</div>
                <div className="mt-1 text-muted text-sm leading-6">{detail}</div>
            </div>
        </div>
    );
}
