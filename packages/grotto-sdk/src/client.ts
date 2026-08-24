import type {
    components,
    GrottoArtifact,
    GrottoChat,
    GrottoChatEvent,
    GrottoChatMessage,
    GrottoChatMessageReceipt,
    GrottoChatResponse,
    GrottoChatTimelinePage,
    GrottoClearChatReceipt,
    GrottoCreateChatRequest,
    GrottoCreateDeliveryRequest,
    GrottoCreateMessageRequest,
    GrottoDeleteResponseReceipt,
    GrottoEnsureThreadRequest,
    GrottoEventList,
    GrottoListChatsResponse,
    GrottoListMessagesResponse,
    GrottoListResponsesResponse,
    GrottoMarkReadRequest,
    GrottoResponseActivity,
    GrottoResponseEvidence,
    GrottoSetThreadFollowRequest,
    GrottoTurnFileChangeEvidence,
    GrottoTurnPromptEvidence,
    GrottoUpsertArtifactRequest,
    GrottoUpsertResponseActivityRequest,
    GrottoUpsertResponseRequest,
} from '@grotto/api';

type GrottoDeliveryReceipt = components['schemas']['DeliveryReceipt'];
type GrottoReadReceipt = components['schemas']['ReadReceipt'];
type HeaderFactory = HeadersInit | (() => HeadersInit | Promise<HeadersInit>);

export interface GrottoClientOptions {
    baseUrl: string;
    fetch?: typeof fetch;
    headers?: HeaderFactory;
    token?: string;
    WebSocket?: typeof WebSocket;
}

export interface GrottoRequestOptions {
    body?: unknown;
    headers?: HeadersInit;
    method?: string;
    query?: Record<string, number | string | null | undefined>;
}

export interface GrottoEventSocketOptions {
    onEvent?: (event: GrottoChatEvent) => void;
    onMessage?: (event: MessageEvent<string>) => void;
    recipientId?: string | null;
}

export class GrottoApiError extends Error {
    readonly payload: unknown;
    readonly status: number;

    constructor(status: number, payload: unknown) {
        super(`Grotto API request failed with status ${status}.`);
        this.name = 'GrottoApiError';
        this.payload = payload;
        this.status = status;
    }
}

export class GrottoClient {
    readonly chat: GrottoChatClient;
    readonly message: GrottoMessageClient;
    readonly realtime: GrottoRealtimeClient;

    readonly #baseUrl: string;
    readonly #fetch: typeof fetch;
    readonly #headers?: HeaderFactory;
    readonly #token?: string;
    readonly #WebSocket?: typeof WebSocket;

    constructor(options: GrottoClientOptions) {
        this.#baseUrl = options.baseUrl.replace(/\/+$/u, '');
        this.#fetch = options.fetch ?? fetch;
        this.#headers = options.headers;
        this.#token = options.token;
        this.#WebSocket = options.WebSocket ?? globalThis.WebSocket;
        this.chat = new GrottoChatClient(this);
        this.message = new GrottoMessageClient(this);
        this.realtime = new GrottoRealtimeClient(this);
    }

    async request<ResponseBody>(path: string, options: GrottoRequestOptions = {}) {
        const response = await this.#fetch(this.url(path, options.query), {
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            headers: await this.headers(options.headers, options.body !== undefined),
            method: options.method ?? 'GET',
        });

        if (!response.ok) {
            throw new GrottoApiError(response.status, await readResponse(response));
        }

        return (await response.json()) as ResponseBody;
    }

    socket(path: string, query?: GrottoRequestOptions['query']) {
        if (!this.#WebSocket) {
            throw new Error('No WebSocket implementation is available.');
        }

        return new this.#WebSocket(this.websocketUrl(path, query));
    }

    private url(path: string, query?: GrottoRequestOptions['query']) {
        const url = new URL(path, `${this.#baseUrl}/`);
        appendQuery(url, query);
        return url;
    }

    private websocketUrl(path: string, query?: GrottoRequestOptions['query']) {
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

class GrottoChatClient {
    readonly #client: GrottoClient;

    constructor(client: GrottoClient) {
        this.#client = client;
    }

    list(input: { cursor?: string | null; limit?: number; readerId?: string } = {}) {
        return this.#client.request<GrottoListChatsResponse>('/api/chats', {
            query: {
                cursor: input.cursor,
                limit: input.limit,
                reader_id: input.readerId,
            },
        });
    }

    create(input: GrottoCreateChatRequest) {
        return this.#client.request<GrottoChat>('/api/chats', {
            body: input,
            method: 'POST',
        });
    }

    get(chatId: string, input: { readerId?: string } = {}) {
        return this.#client.request<GrottoChat>(`/api/chats/${encodeURIComponent(chatId)}`, {
            query: { reader_id: input.readerId },
        });
    }

    ensureThread(chatId: string, input: GrottoEnsureThreadRequest) {
        return this.#client.request<GrottoChat>(
            `/api/chats/${encodeURIComponent(chatId)}/threads`,
            { body: input, method: 'POST' }
        );
    }

    setThreadFollow(chatId: string, input: GrottoSetThreadFollowRequest) {
        return this.#client.request<{ followed: boolean }>(
            `/api/chats/${encodeURIComponent(chatId)}/follow`,
            { body: input, method: 'PUT' }
        );
    }

    messages(
        chatId: string,
        input: { afterSequence?: number; beforeSequence?: number; limit?: number } = {}
    ) {
        return this.#client.request<GrottoListMessagesResponse>(
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
        return this.#client.request<GrottoListMessagesResponse>(
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
        return this.#client.request<GrottoChatTimelinePage>(
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
        return this.#client.request<GrottoListResponsesResponse>(
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
        return this.#client.request<GrottoResponseActivity>(
            `/api/chats/${encodeURIComponent(chatId)}/activity/${encodeURIComponent(activityId)}`
        );
    }

    responseEvidence(chatId: string, responseId: string) {
        return this.#client.request<GrottoResponseEvidence>(
            `/api/chats/${encodeURIComponent(chatId)}/responses/${encodeURIComponent(responseId)}/evidence`
        );
    }

    turnPrompt(runId: string) {
        return this.#client.request<GrottoTurnPromptEvidence>(
            `/api/turns/${encodeURIComponent(runId)}/prompt`
        );
    }

    turnFileChanges(runId: string) {
        return this.#client.request<GrottoTurnFileChangeEvidence>(
            `/api/turns/${encodeURIComponent(runId)}/file-changes`
        );
    }

    createMessage(chatId: string, input: GrottoCreateMessageRequest) {
        return this.#client.request<GrottoChatMessageReceipt>(
            `/api/chats/${encodeURIComponent(chatId)}/messages`,
            {
                body: input,
                method: 'POST',
            }
        );
    }

    createDelivery(chatId: string, input: GrottoCreateDeliveryRequest) {
        return this.#client.request<GrottoDeliveryReceipt>(
            `/api/chats/${encodeURIComponent(chatId)}/deliveries`,
            {
                body: input,
                method: 'POST',
            }
        );
    }

    upsertResponse(chatId: string, input: GrottoUpsertResponseRequest) {
        return this.#client.request<GrottoChatResponse>(
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
        input: GrottoUpsertResponseActivityRequest
    ) {
        return this.#client.request<GrottoResponseActivity>(
            `/api/chats/${encodeURIComponent(chatId)}/responses/${encodeURIComponent(responseId)}/activity`,
            {
                body: input,
                method: 'POST',
            }
        );
    }

    upsertArtifact(chatId: string, input: GrottoUpsertArtifactRequest) {
        return this.#client.request<GrottoArtifact>(
            `/api/chats/${encodeURIComponent(chatId)}/artifacts`,
            {
                body: input,
                method: 'POST',
            }
        );
    }

    markRead(chatId: string, input: GrottoMarkReadRequest) {
        return this.#client.request<GrottoReadReceipt>(
            `/api/chats/${encodeURIComponent(chatId)}/read`,
            {
                body: input,
                method: 'POST',
            }
        );
    }

    clear(chatId: string) {
        return this.#client.request<GrottoClearChatReceipt>(
            `/api/chats/${encodeURIComponent(chatId)}/clear`,
            {
                method: 'POST',
            }
        );
    }

    deleteResponse(responseId: string) {
        return this.#client.request<GrottoDeleteResponseReceipt>(
            `/api/responses/${encodeURIComponent(responseId)}`,
            {
                method: 'DELETE',
            }
        );
    }
}

class GrottoRealtimeClient {
    readonly #client: GrottoClient;

    constructor(client: GrottoClient) {
        this.#client = client;
    }

    events(input: { limit?: number; recipientId?: string | null } = {}) {
        return this.#client.request<GrottoEventList>('/api/events', {
            query: {
                limit: input.limit,
                recipient_id: input.recipientId,
            },
        });
    }

    connect(input: GrottoEventSocketOptions = {}) {
        const socket = this.#client.socket('/api/events/ws', {
            recipient_id: input.recipientId,
        });

        if (input.onMessage) {
            socket.addEventListener('message', input.onMessage as EventListener);
        }

        if (input.onEvent) {
            socket.addEventListener('message', (event: MessageEvent<string>) => {
                input.onEvent?.(JSON.parse(event.data) as GrottoChatEvent);
            });
        }

        return socket;
    }
}

class GrottoMessageClient {
    readonly #client: GrottoClient;

    constructor(client: GrottoClient) {
        this.#client = client;
    }

    get(messageId: string) {
        return this.#client.request<GrottoChatMessage>(
            `/api/messages/${encodeURIComponent(messageId)}`
        );
    }
}

export function createGrottoClient(options: GrottoClientOptions) {
    return new GrottoClient(options);
}

function appendQuery(url: URL, query: GrottoRequestOptions['query']) {
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
