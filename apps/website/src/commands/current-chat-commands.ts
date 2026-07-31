import { toast } from '@heroui/react';
import { CopyLinkIcon, CursorTextIcon, UserCircleIcon } from '@hugeicons-pro/core-stroke-rounded';
import { getChatAgentId } from '../features/chats/chat-list-data.ts';
import { appRoutes } from '../lib/app-routes.ts';
import { writeClipboardText } from '../lib/clipboard.ts';
import { requestChatComposerFocus } from './chat-composer-focus.ts';
import type { AppCommand, AppCommandBuildContext, AppCommandGroup } from './types.ts';

export function buildCurrentChatCommandGroup(
    context: AppCommandBuildContext
): AppCommandGroup | null {
    const chatId = getCurrentChatId(context.pathname);

    if (!chatId || chatId === 'new') {
        return null;
    }

    return {
        commands: [
            {
                disabledReason: context.currentChat ? null : 'Chat is still loading.',
                icon: CursorTextIcon,
                id: 'current-chat.focus-composer',
                keywords: ['chat', 'composer', 'prompt', 'input', 'message'],
                run: requestChatComposerFocus,
                title: 'Focus Composer',
            },
            {
                icon: CopyLinkIcon,
                id: 'current-chat.copy-link',
                keywords: ['chat', 'copy', 'link', 'url'],
                run: async () => {
                    await writeClipboardText(window.location.href);
                    toast.success('Chat link copied');
                },
                title: 'Copy Chat Link',
            },
            ...buildCurrentAgentCommands(context),
        ],
        id: 'current-chat',
        title: 'Current Chat',
    };
}

export function getCurrentChatId(pathname: string) {
    const match = /^\/chats\/([^/]+)/u.exec(pathname);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function buildCurrentAgentCommands(context: AppCommandBuildContext): AppCommand[] {
    const agentId = context.currentChat ? getChatAgentId(context.currentChat) : null;

    if (!agentId) {
        return [];
    }

    return [
        {
            icon: UserCircleIcon,
            id: 'current-chat.open-agent-settings',
            keywords: ['chat', 'agent', 'settings', 'assistant'],
            run: () => context.navigate(appRoutes.memberAgent(agentId)),
            title: 'Agent Profile',
        },
    ];
}
