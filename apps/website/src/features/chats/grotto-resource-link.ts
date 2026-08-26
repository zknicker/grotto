import type { ChatPaneTarget } from '@grotto/api';
import {
    formatChatPaneTargetLink,
    isWorkspaceChatPaneTarget,
    parseChatPaneTargetLink,
} from '@grotto/api/pane-links';

// Pane targets and the grotto:// link scheme are the Runtime contract's; the
// app-local alias adds the authoring Agent for Server workspace targets. The
// link itself remains portable; Server Chat derives ownership from the
// durable message author rather than encoding identity in user-authored text.
type WorkspaceResourceTarget = Extract<ChatPaneTarget, { kind: `workspace${string}` }> & {
    agentId?: string;
};
export type GrottoResourceTarget =
    | Exclude<ChatPaneTarget, { kind: `workspace${string}` }>
    | WorkspaceResourceTarget;

export const parseGrottoResourceLink = parseChatPaneTargetLink;
export const formatGrottoResourceLink = formatChatPaneTargetLink;
export { isWorkspaceChatPaneTarget };

export function getArtifactPanelTargetKey(target: GrottoResourceTarget) {
    const agentKey = 'agentId' in target && target.agentId ? `${target.agentId}:` : '';
    return `${target.kind}:${agentKey}${target.path}`;
}

export function bindWorkspaceTargetToAgent(
    target: GrottoResourceTarget,
    agentId: string | undefined
): GrottoResourceTarget {
    if (!(agentId && isWorkspaceChatPaneTarget(target))) {
        return target;
    }
    return { ...target, agentId };
}

export function getArtifactPanelTargetLabel(target: GrottoResourceTarget) {
    // The workspace is one tab; it reads "Workspace" whenever no file is open.
    if (target.kind === 'workspaceDirectory' || target.kind === 'workspaceRoot') {
        return 'Workspace';
    }

    const label = target.path.split('/').filter(Boolean).at(-1);
    return label && label.length > 0 ? label : target.path;
}
