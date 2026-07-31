import type {
    components,
    TavernArtifact,
    TavernChat,
    TavernChatEvent,
    TavernChatMessage,
    TavernChatMessageReceipt,
    TavernChatResponse,
    TavernChatTimelinePage,
    TavernClearChatReceipt,
    TavernCreateChatRequest,
    TavernCreateDeliveryRequest,
    TavernCreateMessageRequest,
    TavernDeleteResponseReceipt,
    TavernEnsureThreadRequest,
    TavernEventList,
    TavernListChatsResponse,
    TavernListMessagesResponse,
    TavernListResponsesResponse,
    TavernMarkReadRequest,
    TavernResponseActivity,
    TavernResponseEvidence,
    TavernSetThreadFollowRequest,
    TavernTurnFileChangeEvidence,
    TavernTurnPromptEvidence,
    TavernUpsertArtifactRequest,
    TavernUpsertResponseActivityRequest,
    TavernUpsertResponseRequest,
} from '@tavern/api';

type TavernDeliveryReceipt = components['schemas']['DeliveryReceipt'];
type TavernReadReceipt = components['schemas']['ReadReceipt'];
type HeaderFactory = HeadersInit | (() => HeadersInit | Promise<HeadersInit>);

export interface TavernClientOptions {
    baseUrl: string;
    fetch?: typeof fetch;
    headers?: HeaderFactory;
    token?: string;
    WebSocket?: typeof WebSocket;
}

export interface TavernRequestOptions {
    body?: unknown;
    headers?: HeadersInit;
    method?: string;
    query?: Record<string, number | string | null | undefined>;
}

export interface TavernEventSocketOptions {
    onEvent?: (event: TavernChatEvent) => void;
    onMessage?: (event: MessageEvent<string>) => void;
    recipientId?: string | null;
}

export class TavernApiError extends Error {
    readonly payload: unknown;
    readonly status: number;

    constructor(status: number, payload: unknown) {
        super(`Tavern API request failed with status ${status}.`);
        this.name = 'TavernApiError';
        this.payload = payload;
        this.status = status;
    }
}

export class TavernClient {
    readonly chat: TavernChatClient;
    readonly message: TavernMessageClient;
    readonly realtime: TavernRealtimeClient;

    readonly #baseUrl: string;
    readonly #fetch: typeof fetch;
    readonly #headers?: HeaderFactory;
    readonly #token?: string;
    readonly #WebSocket?: typeof WebSocket;

    constructor(options: TavernClientOptions) {
        this.#baseUrl = options.baseUrl.replace(/\/+$/u, '');
        this.#fetch = options.fetch ?? fetch;
        this.#headers = options.headers;
        this.#token = options.token;
        this.#WebSocket = options.WebSocket ?? globalThis.WebSocket;
        this.chat = new TavernChatClient(this);
        this.message = new TavernMessageClient(this);
        this.realtime = new TavernRealtimeClient(this);
    }

    async request<ResponseBody>(path: string, options: TavernRequestOptions = {}) {
        const response = await this.#fetch(this.url(path, options.query), {
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            headers: await this.headers(options.headers, options.body !== undefined),
            method: options.method ?? 'GET',
        });

        if (!response.ok) {
            throw new TavernApiError(response.status, await readResponse(response));
        }

        return (await response.json()) as ResponseBody;
    }

    socket(path: string, query?: TavernRequestOptions['query']) {
        if (!this.#WebSocket) {
            throw new Error('No WebSocket implementation is available.');
        }

        return new this.#WebSocket(this.websocketUrl(path, query));
    }

    private url(path: string, query?: TavernRequestOptions['query']) {
        const url = new URL(path, `${this.#baseUrl}/`);
        appendQuery(url, query);
        return url;
    }

    private websocketUrl(path: string, query?: TavernRequestOptions['query']) {
        const url = this.url(path, query);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        return url;
    }

    private async headers(headers: HeadersInit | undefined, hasBody: boolean) {
        const output = new Headers(await resolveHeaders(this.#headers));

        if (hasBody && !output.has('content-type')) {
            output.set('content-type', 'application/json');
        }

        if (this.#token && !output.has('authorization')) {
            output.set('authorization', `Bearer ${this.#token}`);
        }

        for (const [key, value] of new Headers(headers)) {
            output.set(key, value);
        }

        return output;
    }
}

class TavernChatClient {
    readonly #client: TavernClient;

    constructor(client: TavernClient) {
        this.#client = client;
    }

    list(input: { cursor?: string | null; limit?: number; readerId?: string } = {}) {
        return this.#client.request<TavernListChatsResponse>('/api/chats', {
            query: {
                cursor: input.cursor,
                limit: input.limit,
                reader_id: input.readerId,
            },
        });
    }

    create(input: TavernCreateChatRequest) {
        return this.#client.request<TavernChat>('/api/chats', {
            body: input,
            method: 'POST',
        });
    }

    get(chatId: string, input: { readerId?: string } = {}) {
        return this.#client.request<TavernChat>(`/api/chats/${encodeURIComponent(chatId)}`, {
            query: { reader_id: input.readerId },
        });
    }

    ensureThread(chatId: string, input: TavernEnsureThreadRequest) {
        return this.#client.request<TavernChat>(
            `/api/chats/${encodeURIComponent(chatId)}/threads`,
            { body: input, method: 'POST' }
        );
    }

    setThreadFollow(chatId: string, input: TavernSetThreadFollowRequest) {
        return this.#client.request<{ followed: boolean }>(
            `/api/chats/${encodeURIComponent(chatId)}/follow`,
            { body: input, method: 'PUT' }
        );
    }

    messages(
        chatId: string,
        input: { afterSequence?: number; beforeSequence?: number; limit?: number } = {}
    ) {
        return this.#client.request<TavernListMessagesResponse>(
            `/api/chats/${encodeURIComponent(chatId)}/messages`,
            {
                query: {
                    after_sequence: input.afterSequence,
                    before_sequence: input.beforeSequence,
                    limit: input.limit,
                },
            }
        );
    }

    searchMessages(chatId: string, input: { limit?: number; query: string }) {
        return this.#client.request<TavernListMessagesResponse>(
            `/api/chats/${encodeURIComponent(chatId)}/messages/search`,
            {
                query: {
                    limit: input.limit,
                    query: input.query,
                },
            }
        );
    }

    timeline(
        chatId: string,
        input: { beforeSequence?: number; limit?: number; readerId?: string } = {}
    ) {
        return this.#client.request<TavernChatTimelinePage>(
            `/api/chats/${encodeURIComponent(chatId)}/timeline`,
            {
                query: {
                    before_sequence: input.beforeSequence,
                    limit: input.limit,
                    reader_id: input.readerId,
                },
            }
        );
    }

    responses(chatId: string, input: { afterSequence?: number; limit?: number } = {}) {
        return this.#client.request<TavernListResponsesResponse>(
            `/api/chats/${encodeURIComponent(chatId)}/responses`,
            {
                query: {
                    after_sequence: input.afterSequence,
                    limit: input.limit,
                },
            }
        );
    }

    activity(chatId: string, activityId: string) {
        return this.#client.request<TavernResponseActivity>(
            `/api/chats/${encodeURIComponent(chatId)}/activity/${encodeURIComponent(activityId)}`
        );
    }

    responseEvidence(chatId: string, responseId: string) {
        return this.#client.request<TavernResponseEvidence>(
            `/api/chats/${encodeURIComponent(chatId)}/responses/${encodeURIComponent(responseId)}/evidence`
        );
    }

    turnPrompt(runId: string) {
        return this.#client.request<TavernTurnPromptEvidence>(
            `/api/turns/${encodeURIComponent(runId)}/prompt`
        );
    }

    turnFileChanges(runId: string) {
        return this.#client.request<TavernTurnFileChangeEvidence>(
            `/api/turns/${encodeURIComponent(runId)}/file-changes`
        );
    }

    createMessage(chatId: string, input: TavernCreateMessageRequest) {
        return this.#client.request<TavernChatMessageReceipt>(
            `/api/chats/${encodeURIComponent(chatId)}/messages`,
            {
                body: input,
                method: 'POST',
            }
        );
    }

    createDelivery(chatId: string, input: TavernCreateDeliveryRequest) {
        return this.#client.request<TavernDeliveryReceipt>(
            `/api/chats/${encodeURIComponent(chatId)}/deliveries`,
            {
                body: input,
                method: 'POST',
            }
        );
    }

    upsertResponse(chatId: string, input: TavernUpsertResponseRequest) {
        return this.#client.request<TavernChatResponse>(
            `/api/chats/${encodeURIComponent(chatId)}/responses`,
            {
                body: input,
                method: 'POST',
            }
        );
    }

    upsertResponseActivity(
        chatId: string,
        responseId: string,
        input: TavernUpsertResponseActivityRequest
    ) {
        return this.#client.request<TavernResponseActivity>(
            `/api/chats/${encodeURIComponent(chatId)}/responses/${encodeURIComponent(responseId)}/activity`,
            {
                body: input,
                method: 'POST',
            }
        );
    }

    upsertArtifact(chatId: string, input: TavernUpsertArtifactRequest) {
        return this.#client.request<TavernArtifact>(
            `/api/chats/${encodeURIComponent(chatId)}/artifacts`,
            {
                body: input,
                method: 'POST',
            }
        );
    }

    markRead(chatId: string, input: TavernMarkReadRequest) {
        return this.#client.request<TavernReadReceipt>(
            `/api/chats/${encodeURIComponent(chatId)}/read`,
            {
                body: input,
                method: 'POST',
            }
        );
    }

    clear(chatId: string) {
        return this.#client.request<TavernClearChatReceipt>(
            `/api/chats/${encodeURIComponent(chatId)}/clear`,
            {
                method: 'POST',
            }
        );
    }

    deleteResponse(responseId: string) {
        return this.#client.request<TavernDeleteResponseReceipt>(
            `/api/responses/${encodeURIComponent(responseId)}`,
            {
                method: 'DELETE',
            }
        );
    }
}

class TavernRealtimeClient {
    readonly #client: TavernClient;

    constructor(client: TavernClient) {
        this.#client = client;
    }

    events(input: { limit?: number; recipientId?: string | null } = {}) {
        return this.#client.request<TavernEventList>('/api/events', {
            query: {
                limit: input.limit,
                recipient_id: input.recipientId,
            },
        });
    }

    connect(input: TavernEventSocketOptions = {}) {
        const socket = this.#client.socket('/api/events/ws', {
            recipient_id: input.recipientId,
        });

        if (input.onMessage) {
            socket.addEventListener('message', input.onMessage as EventListener);
        }

        if (input.onEvent) {
            socket.addEventListener('message', (event: MessageEvent<string>) => {
                input.onEvent?.(JSON.parse(event.data) as TavernChatEvent);
            });
        }

        return socket;
    }
}

class TavernMessageClient {
    readonly #client: TavernClient;

    constructor(client: TavernClient) {
        this.#client = client;
    }

    get(messageId: string) {
        return this.#client.request<TavernChatMessage>(
            `/api/messages/${encodeURIComponent(messageId)}`
        );
    }
}

export function createTavernClient(options: TavernClientOptions) {
    return new TavernClient(options);
}

function appendQuery(url: URL, query: TavernRequestOptions['query']) {
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
        }
    }
}

async function resolveHeaders(headers: HeaderFactory | undefined) {
    if (typeof headers === 'function') {
        return await headers();
    }

    return headers;
}

async function readResponse(response: Response) {
    const text = await response.text();

    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}
