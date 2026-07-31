import * as React from 'react';
import type { ChatArtifactPanelState } from '../../hooks/pane/use-chat-pane-state.ts';
import { setChatSidePane, useChatSidePane } from '../../hooks/pane/use-chat-side-pane.ts';
import {
    getArtifactPanelTargetKey,
    isWorkspaceChatPaneTarget,
    type TavernResourceTarget,
} from '../chats/tavern-resource-link.ts';

export function useHostedChatArtifactPanel(chatId: string): ChatArtifactPanelState {
    const activeSidePane = useChatSidePane(chatId);
    const [visible, setVisible] = React.useState(false);
    const [pane, setPane] = React.useState<HostedPaneState>({
        activeKey: null,
        targets: [],
    });

    const open = React.useCallback(
        (target: TavernResourceTarget) => {
            if (!(isWorkspaceChatPaneTarget(target) && target.agentId)) {
                return;
            }
            setChatSidePane(chatId, 'artifact');
            setVisible(true);
            setPane((current) => mergeHostedArtifactTarget(current, target));
        },
        [chatId]
    );
    const closeTarget = React.useCallback((key: string) => {
        setPane((current) => closeHostedArtifactTarget(current, key));
    }, []);
    const closeActiveTarget = React.useCallback(() => {
        setPane((current) =>
            current.activeKey ? closeHostedArtifactTarget(current, current.activeKey) : current
        );
    }, []);
    const setActiveKey = React.useCallback((key: string) => {
        setPane((current) =>
            current.targets.some((target) => getArtifactPanelTargetKey(target) === key)
                ? { ...current, activeKey: key }
                : current
        );
    }, []);
    const toggleVisible = React.useCallback(() => {
        setVisible((current) => {
            if (!current || activeSidePane !== 'artifact') {
                setChatSidePane(chatId, 'artifact');
                return true;
            }
            return false;
        });
    }, [activeSidePane, chatId]);

    return {
        ...pane,
        closeActiveTarget,
        closeTarget,
        open,
        setActiveKey,
        toggleVisible,
        visible: visible && activeSidePane === 'artifact',
    };
}

interface HostedPaneState {
    activeKey: string | null;
    targets: TavernResourceTarget[];
}

export function mergeHostedArtifactTarget(
    current: HostedPaneState,
    target: TavernResourceTarget
): HostedPaneState {
    const key = getArtifactPanelTargetKey(target);
    if (current.targets.some((candidate) => getArtifactPanelTargetKey(candidate) === key)) {
        return current.activeKey === key ? current : { ...current, activeKey: key };
    }

    if (isWorkspaceChatPaneTarget(target)) {
        const workspaceIndex = current.targets.findIndex(
            (candidate) =>
                isWorkspaceChatPaneTarget(candidate) && candidate.agentId === target.agentId
        );
        const workspaceTarget = current.targets[workspaceIndex];
        if (workspaceTarget) {
            if (target.kind !== 'workspaceFile') {
                return {
                    ...current,
                    activeKey: getArtifactPanelTargetKey(workspaceTarget),
                };
            }
            return {
                activeKey: key,
                targets: current.targets.map((candidate, index) =>
                    index === workspaceIndex ? target : candidate
                ),
            };
        }
    }

    return { activeKey: key, targets: [...current.targets, target] };
}

function closeHostedArtifactTarget(current: HostedPaneState, key: string): HostedPaneState {
    const closingIndex = current.targets.findIndex(
        (target) => getArtifactPanelTargetKey(target) === key
    );
    if (closingIndex === -1) {
        return current;
    }
    const targets = current.targets.filter((target) => getArtifactPanelTargetKey(target) !== key);
    if (current.activeKey !== key) {
        return { ...current, targets };
    }
    const activeTarget = targets.at(Math.min(closingIndex, targets.length - 1));
    return {
        activeKey: activeTarget ? getArtifactPanelTargetKey(activeTarget) : null,
        targets,
    };
}
