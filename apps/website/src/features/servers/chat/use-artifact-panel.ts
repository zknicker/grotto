import * as React from 'react';
import type { ChatArtifactPanelState } from '../../../hooks/pane/use-chat-pane-state.ts';
import { setChatSidePane, useChatSidePane } from '../../../hooks/pane/use-chat-side-pane.ts';
import {
    getArtifactPanelTargetKey,
    isWorkspaceChatPaneTarget,
    type TavernResourceTarget,
} from '../../chats/tavern-resource-link.ts';

export function useChatArtifactPanel(chatId: string): ChatArtifactPanelState {
    const activeSidePane = useChatSidePane(chatId);
    const [visible, setVisible] = React.useState(false);
    const [pane, setPane] = React.useState<ArtifactPaneState>({
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
            setPane((current) => mergeArtifactTarget(current, target));
        },
        [chatId]
    );
    const closeTarget = React.useCallback((key: string) => {
        setPane((current) => closeArtifactTarget(current, key));
    }, []);
    const closeActiveTarget = React.useCallback(() => {
        setPane((current) =>
            current.activeKey ? closeArtifactTarget(current, current.activeKey) : current
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

interface ArtifactPaneState {
    activeKey: string | null;
    targets: TavernResourceTarget[];
}

export function mergeArtifactTarget(
    current: ArtifactPaneState,
    target: TavernResourceTarget
): ArtifactPaneState {
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

function closeArtifactTarget(current: ArtifactPaneState, key: string): ArtifactPaneState {
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
