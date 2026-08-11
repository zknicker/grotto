import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createWSClient, httpBatchLink, loggerLink, splitLink, wsLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import * as React from 'react';
import type { AppRouter } from '../../../server/src/api/router.ts';
import { TrpcEventListeners } from '../components/trpc-event-listeners.tsx';
import { ChatTimelineProvider } from '../hooks/chats/use-chat-timeline-store.tsx';
import { TimelineContextProvider } from '../hooks/chats/use-timeline-context.tsx';
import {
    ensureDesktopServerOrigin,
    getConfiguredServerOrigin,
    isPackagedDesktopApp,
} from './agent-runtime.ts';
import { getClerkSessionToken } from './clerk.tsx';
import { queryClientDefaultOptions } from './query-policy.ts';

export const trpc = createTRPCReact<AppRouter>();

type RouterOutput = inferRouterOutputs<AppRouter>;
type RouterInput = inferRouterInputs<AppRouter>;

export type AppRouterOutputs = RouterOutput;
export type AppRouterInputs = RouterInput;
export type AgentOutput = RouterOutput['agent']['get'];
export type AgentActivityOutput = RouterOutput['agent']['activity'];
export type AgentPresenceOutput = RouterOutput['agent']['presence'];
export type AgentChatListOutput = RouterOutput['agent']['chats']['list'];
export type AgentListOutput = RouterOutput['agent']['list'];
export type AgentSessionOutput = RouterOutput['agent']['session'];
export type PrimaryAgentOutput = RouterOutput['agent']['primary'];
export type ChatGetOutput = RouterOutput['chat']['get'];
export type ChatFilesOutput = RouterOutput['chat']['files']['list'];
export type ChatMessageAttachmentInput = NonNullable<
    RouterInput['chat']['send']['attachments']
>[number];
export type ChatListOutput = RouterOutput['chat']['list'];
export type ChatLogOutput = RouterOutput['chat']['log']['list'];
export type ChatToolOutput = RouterOutput['chat']['tool']['get'];
export type McpConnectionListOutput = RouterOutput['mcp']['list'];
export type McpConnectionTool = RouterOutput['mcp']['connectionTools']['tools'][number];
export type McpConnectionSaveInput = RouterInput['mcp']['add'];
export type JobsListOutput = RouterOutput['jobs']['list'];
export type TaskListOutput = RouterOutput['task']['list'];
export type TaskListItem = TaskListOutput['tasks'][number];
export type LabelListOutput = RouterOutput['label']['list'];
export type LabelRecord = LabelListOutput['labels'][number];
export type TaskLabelColor = LabelRecord['color'];
export type ReminderListOutput = RouterOutput['reminder']['list'];
export type ReminderRecord = ReminderListOutput['reminders'][number];
export type ReminderRunsOutput = RouterOutput['reminder']['runs'];
export type JobDetailOutput = RouterOutput['jobs']['get']['job'];
export type JobRecentRunsOutput = RouterOutput['jobs']['recentRuns'];
export type LogListOutput = RouterOutput['log']['list'];
export type MentionInventoryOutput = RouterOutput['mention']['inventory'];
export type MentionPathOutput = RouterOutput['mention']['paths'];
export type ModelListOutput = RouterOutput['model']['list'];
export type ModelInventoryOutput = RouterOutput['model']['inventory'];
export type BrowserSettingsOutput = RouterOutput['browser']['get'];
export type MessagingPlatformListOutput = RouterOutput['messagingPlatform']['list'];
export type LiveUsageOutput = RouterOutput['usage']['live'];
export type AgentRuntimeConnectionOutput = RouterOutput['agentRuntime']['get'];
export type ModelAccessOutput = RouterOutput['modelAccess']['get'];
export type OpenAiSettingsOutput = RouterOutput['openAiSettings']['get'];
export type OpenRouterSettingsOutput = RouterOutput['openRouterSettings']['get'];
export type ParticipantListOutput = RouterOutput['participant']['list'];
export type SessionListOutput = RouterOutput['session']['list'];
export type SessionHistoryOutput = RouterOutput['session']['history']['get'];
export type SessionPromptOutput = RouterOutput['session']['prompt']['get'];
export type HistoryActorOutput = NonNullable<
    Extract<SessionHistoryOutput['rows'][number], { kind: 'message' }>['actor']
>;
export type SessionHistoryMessageRowOutput = Extract<
    SessionHistoryOutput['rows'][number],
    { kind: 'message' }
>;
export type SessionHistoryToolCallOutput = Extract<
    SessionHistoryOutput['rows'][number],
    { kind: 'tool' }
>['toolCall'];
export type SessionHistoryWorkerRowOutput = Extract<
    SessionHistoryOutput['rows'][number],
    { kind: 'worker' }
>;
export type SessionHistorySystemRowOutput = Extract<
    SessionHistoryOutput['rows'][number],
    { kind: 'system' }
>;
export type SessionRelationshipOutput = NonNullable<SessionHistoryOutput['parentRelationship']>;
export type SessionHistoryAccessEventRowOutput = Extract<
    SessionHistorySystemRowOutput,
    { systemKind: 'accessEvent' }
>;
export type SessionHistoryArtifactRowOutput = Extract<
    SessionHistorySystemRowOutput,
    { systemKind: 'artifact' }
>;
export type SessionHistoryDeliveryOutput = Extract<
    SessionHistorySystemRowOutput,
    { systemKind: 'delivery' }
>['delivery'];
export type SessionHistoryThinkingRowOutput = Extract<
    SessionHistorySystemRowOutput,
    { systemKind: 'thinking' }
>;
export type SessionOutput = RouterOutput['session']['get'];
export type SessionMetadataOutput = SessionOutput['session'];
export type SessionToolOutput = RouterOutput['session']['tool']['get'];
export type SkillHubAvailableOutput = RouterOutput['skill']['hubAvailable'];
export type SkillHubItemOutput = SkillHubAvailableOutput['builtin'][number];
export type SkillHubPreviewOutput = RouterOutput['skill']['hubPreview'];
export type SkillHubScanOutput = RouterOutput['skill']['hubScan'];
export type SkillHubTapListOutput = RouterOutput['skill']['hubTaps'];
export type SkillListOutput = RouterOutput['skill']['list'];
export type SkillRuntimeListOutput = RouterOutput['skill']['runtimeList'];
export type ToolConfigOutput = RouterOutput['skill']['toolConfig'];
export type SubAgentListOutput = RouterOutput['subAgent']['list'];
export type WorkerListOutput = RouterOutput['worker']['list'];

function getTrpcUrl(serverOrigin: string | null) {
    if (!serverOrigin) {
        return '/trpc';
    }

    return new URL('/trpc', serverOrigin).toString();
}

function getTrpcWebSocketUrl(serverOrigin: string | null) {
    const url = serverOrigin
        ? new URL('/trpc', serverOrigin)
        : new URL('/trpc', window.location.origin);

    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

    return url.toString();
}

function createTrpcClient(serverOrigin: string | null, queryClient: QueryClient) {
    let hasOpened = false;
    const wsClient = createWSClient({
        connectionParams: async () => {
            const token = await getClerkSessionToken();
            return token ? { clerkSessionToken: token } : {};
        },
        onOpen: () => {
            if (hasOpened) {
                void queryClient.invalidateQueries({ refetchType: 'active' });
                return;
            }

            hasOpened = true;
        },
        url: getTrpcWebSocketUrl(serverOrigin),
    });
    const trpcUrl = getTrpcUrl(serverOrigin);

    return {
        client: trpc.createClient({
            links: [
                loggerLink({
                    enabled: () => {
                        if (!import.meta.env.DEV) {
                            return false;
                        }

                        return true;
                    },
                    colorMode: 'css',
                }),
                splitLink({
                    condition: (operation) => operation.type === 'subscription',
                    // Batched: concurrent queries share one POST per tick.
                    false: httpBatchLink({
                        headers: async () => {
                            const token = await getClerkSessionToken();
                            return token ? { authorization: `Bearer ${token}` } : {};
                        },
                        methodOverride: 'POST',
                        url: trpcUrl,
                    }),
                    true: wsLink({
                        client: wsClient,
                    }),
                }),
            ],
        }),
        wsClient,
    };
}

export function TavernProviders({ children }: React.PropsWithChildren) {
    const [queryClient] = React.useState(
        () =>
            new QueryClient({
                defaultOptions: queryClientDefaultOptions,
            })
    );

    const [agentRuntimeError, setAgentRuntimeError] = React.useState<Error | null>(null);
    const [serverOrigin, setServerOrigin] = React.useState<string | null>(
        getConfiguredServerOrigin()
    );
    const [isAgentRuntimeReady, setIsAgentRuntimeReady] = React.useState(!isPackagedDesktopApp());

    React.useEffect(() => {
        if (!isPackagedDesktopApp()) {
            return;
        }

        let cancelled = false;

        ensureDesktopServerOrigin()
            .then((origin) => {
                if (cancelled) {
                    return;
                }

                setServerOrigin(origin);
                setIsAgentRuntimeReady(true);
            })
            .catch((error) => {
                if (cancelled) {
                    return;
                }

                setAgentRuntimeError(
                    error instanceof Error
                        ? error
                        : new Error('Failed to start Grotto desktop backend.')
                );
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const clientState = React.useMemo(() => {
        if (!isAgentRuntimeReady) {
            return null;
        }

        return createTrpcClient(serverOrigin, queryClient);
    }, [isAgentRuntimeReady, queryClient, serverOrigin]);

    React.useEffect(() => {
        return () => {
            clientState?.wsClient.close();
        };
    }, [clientState]);

    if (agentRuntimeError) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-foreground">
                <div>
                    <p className="font-medium text-lg">
                        Grotto failed to start its desktop backend.
                    </p>
                    <p className="mt-2 text-muted text-sm">{agentRuntimeError.message}</p>
                </div>
            </div>
        );
    }

    if (!isAgentRuntimeReady) {
        return null;
    }

    if (!clientState) {
        return null;
    }

    return (
        <trpc.Provider client={clientState.client} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <ChatTimelineProvider>
                    <TimelineContextProvider>
                        <TrpcEventListeners />
                        {children}
                    </TimelineContextProvider>
                </ChatTimelineProvider>
            </QueryClientProvider>
        </trpc.Provider>
    );
}
