import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDevMode } from '../components/dev-mode-provider.tsx';
import { toastManager } from '../components/ui/toast.tsx';
import { buildChatList } from '../features/chats/chat-list-data.ts';
import { useChatList } from '../hooks/chats/use-chat-list.ts';
import { useCapability } from '../hooks/connections/use-capability.ts';
import { trpc } from '../lib/trpc.tsx';
import { buildChatNavigationCommandGroups } from './chat-navigation-commands.ts';
import { buildCurrentChatCommandGroup, getCurrentChatId } from './current-chat-commands.ts';
import { buildDeveloperCommandGroup } from './developer-commands.ts';
import { buildNavigationCommandGroup } from './navigation-commands.ts';
import { buildSettingsCommandGroup } from './settings-commands.ts';
import { filterCommandGroups } from './types.ts';

export function useAppCommands() {
    const { pathname } = useLocation();
    const navigateRoute = useNavigate();
    const { devMode, setDevMode } = useDevMode();
    const resolveCapability = useCapability();
    const chatsQuery = useChatList();
    const utils = trpc.useUtils();
    const healthMutation = trpc.agentRuntime.checkHealth.useMutation({
        onError: (error) => {
            toastManager.add({
                description: error.message,
                title: 'Runtime check failed',
                type: 'error',
            });
        },
        onSettled: () => {
            void utils.agentRuntime.get.invalidate();
        },
        onSuccess: () => {
            toastManager.add({ title: 'Runtime check requested', type: 'success' });
        },
    });

    const chatId = getCurrentChatId(pathname);
    const chats = React.useMemo(() => buildChatList(chatsQuery.data), [chatsQuery.data]);
    const currentChat = React.useMemo(() => {
        if (!chatId) {
            return null;
        }

        return chats.find((chat) => chat.id === chatId) ?? null;
    }, [chatId, chats]);

    const navigate = React.useCallback(
        (path: string) => {
            void navigateRoute(path);
        },
        [navigateRoute]
    );

    return React.useMemo(() => {
        const context = {
            checkRuntimeHealth: () => healthMutation.mutate(),
            chats,
            currentChat,
            devMode,
            isCheckingRuntimeHealth: healthMutation.isPending,
            navigate,
            pathname,
            resolveCapability,
            setDevMode,
        };

        return filterCommandGroups(
            [
                buildNavigationCommandGroup(context),
                ...buildChatNavigationCommandGroups(context),
                buildCurrentChatCommandGroup(context),
                buildSettingsCommandGroup(context),
                buildDeveloperCommandGroup(context),
            ].filter((group) => group !== null)
        );
    }, [
        currentChat,
        chats,
        devMode,
        healthMutation.isPending,
        healthMutation.mutate,
        navigate,
        pathname,
        resolveCapability,
        setDevMode,
    ]);
}
