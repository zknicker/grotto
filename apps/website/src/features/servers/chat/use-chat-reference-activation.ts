import { parseAgentReferenceTarget, parseChatReferenceTarget } from '@grotto/api';
import { useCallback } from 'react';
import { openAgentProfilePane } from '../../../hooks/pane/use-agent-profile-pane.ts';
import type { ReferenceActivationTarget } from '../../mentions/mention-types.ts';

export function useChatReferenceActivation(chatId: string, onOpenChat: (id: string) => void) {
    return useCallback(
        (reference: ReferenceActivationTarget) => {
            if (reference.kind === 'agent') {
                const agentId = parseAgentReferenceTarget(reference.id);
                if (agentId) {
                    openAgentProfilePane(chatId, agentId);
                }
                return;
            }
            if (reference.kind === 'chat') {
                const targetChatId = parseChatReferenceTarget(reference.id);
                if (targetChatId) {
                    onOpenChat(targetChatId);
                }
            }
        },
        [chatId, onOpenChat]
    );
}
