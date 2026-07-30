import type { ChatPaneTarget } from '@tavern/api';
// Value imports must use the pane-links subpath: the @tavern/api root index
// reaches node:crypto via runtime config helpers and cannot evaluate in the
// browser.
import {
    formatChatPaneTargetLink,
    isWorkspaceChatPaneTarget,
    parseChatPaneTargetLink,
} from '@tavern/api/pane-links';

// Pane targets and the grotto:// link scheme are the Runtime contract's; the
// app-local alias adds the authoring Agent for hosted workspace targets. The
// link itself remains portable; hosted chat derives ownership from the
// durable message author rather than encoding identity in user-authored text.
type WorkspaceResourceTarget = Extract<ChatPaneTarget, { kind: `workspace${string}` }> & {
    agentId?: string;
};
export type TavernResourceTarget =
    | Exclude<ChatPaneTarget, { kind: `workspace${string}` }>
    | WorkspaceResourceTarget;

export const parseTavernResourceLink = parseChatPaneTargetLink;
export const formatTavernResourceLink = formatChatPaneTargetLink;
export { isWorkspaceChatPaneTarget };

export function getArtifactPanelTargetKey(target: TavernResourceTarget) {
    const agentKey = 'agentId' in target && target.agentId ? `${target.agentId}:` : '';
    return `${target.kind}:${agentKey}${target.path}`;
}

export function bindWorkspaceTargetToAgent(
    target: TavernResourceTarget,
    agentId: string | undefined
): TavernResourceTarget {
    if (!(agentId && isWorkspaceChatPaneTarget(target))) {
        return target;
    }
    return { ...target, agentId };
}

export function getArtifactPanelTargetLabel(target: TavernResourceTarget) {
    // The workspace is one tab; it reads "Workspace" whenever no file is open.
    if (target.kind === 'workspaceDirectory' || target.kind === 'workspaceRoot') {
        return 'Workspace';
    }

    const label = target.path.split('/').filter(Boolean).at(-1);
    return label && label.length > 0 ? label : target.path;
}
