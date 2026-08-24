import * as React from 'react';
import { setChatSidePane, useChatSidePane } from '../../../hooks/pane/use-chat-side-pane.ts';

/**
 * Chat Files pane visibility. Files shares the chat side panel with the
 * artifact, profile, and thread panes; the latest opener wins the slot, and
 * closing hands the slot back to the artifact pane like the profile pane does.
 */
export function useChatFilesPane(chatId: string) {
    const activeSidePane = useChatSidePane(chatId);
    const [visible, setVisible] = React.useState(false);

    const open = React.useCallback(() => {
        setChatSidePane(chatId, 'files');
        setVisible(true);
    }, [chatId]);
    const close = React.useCallback(() => {
        setVisible(false);
        setChatSidePane(chatId, 'artifact');
    }, [chatId]);

    return {
        close,
        open,
        visible: visible && activeSidePane === 'files',
    };
}
