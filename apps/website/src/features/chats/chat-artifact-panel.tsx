import { File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Tabs } from '../../components/ui/tabs.tsx';
import type { ChatArtifactPanelState } from '../../hooks/pane/use-chat-pane-state.ts';
import { cn } from '../../lib/utils.ts';
import { ArtifactPanelChrome } from './chat-artifact-panel-chrome.tsx';
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
    state,
}: {
    agentId: string;
    open?: boolean;
    state: ChatArtifactPanelState;
}) {
    return (
        <ChatSidePaneShell label="Artifacts" open={open && state.visible}>
            {(width) => (
                <ArtifactPanelBody agentId={agentId} state={state} width={width ?? undefined} />
            )}
        </ChatSidePaneShell>
    );
}

// The pane renders only the active target's content; tab selection is
// controlled state so the chrome and body stay in one Tabs root.
function ArtifactPanelBody({
    agentId,
    state,
    width,
}: {
    agentId: string;
    state: ChatArtifactPanelState;
    width?: number;
}) {
    const activeTarget = state.targets.find(
        (target) => getArtifactPanelTargetKey(target) === state.activeKey
    );

    return (
        <div className="flex h-full min-h-0 flex-col" style={width ? { width } : undefined}>
            <div className="shrink-0 border-[var(--content-card-border)] border-b">
                <Tabs
                    className="flex items-center"
                    onValueChange={state.setActiveKey}
                    value={state.activeKey ?? undefined}
                >
                    <ArtifactPanelChrome
                        activeKey={state.activeKey}
                        activeTarget={activeTarget}
                        agentId={agentId}
                        onClose={state.toggleVisible}
                        onCloseTarget={state.closeTarget}
                        onOpenTarget={state.open}
                        targets={state.targets}
                    />
                </Tabs>
            </div>
            <div className="min-h-0 flex-1">
                {activeTarget ? (
                    <ArtifactPanelContent
                        agentId={agentId}
                        // Workspace targets share one tab whose file selection
                        // morphs the target; a stable key keeps the browser
                        // (tree state, loaded folders) mounted across morphs.
                        key={
                            isWorkspaceChatPaneTarget(activeTarget) ? 'workspace' : state.activeKey
                        }
                        onOpenTarget={state.open}
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
    target,
}: {
    agentId: string;
    onOpenTarget: (target: TavernResourceTarget) => void;
    target: TavernResourceTarget;
}) {
    // Stable identity: browser effects key on this callback.
    const openWorkspaceFile = React.useCallback(
        (path: null | string) => {
            if (path) {
                onOpenTarget({ kind: 'workspaceFile', path });
            }
        },
        [onOpenTarget]
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
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
                    <Icon className="size-4 text-muted-foreground" icon={File01Icon} />
                </div>
                <div className="truncate font-medium text-sm">{title}</div>
                <div className={cn('mt-1 text-muted-foreground text-sm leading-6')}>{detail}</div>
            </div>
        </div>
    );
}
