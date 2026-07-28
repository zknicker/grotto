import * as z from 'zod';
import { type AgentContext, resolveAgentContext } from './agent-context.ts';
import { AgentCliError } from './agent-error.ts';

const REQUEST_TIMEOUT_MS = 1500;
const errorResponseSchema = z.object({
    code: z.string().min(1),
    draftSaved: z.boolean().optional(),
    message: z.string().min(1),
    nextAction: z.string().min(1).optional(),
});

export interface AgentApiRequest {
    body?: unknown;
    method?: 'DELETE' | 'GET' | 'POST';
    query?: Record<string, boolean | number | string | undefined>;
    signal?: AbortSignal;
}

export interface AgentApiRequester {
    request<T>(route: string, schema: z.ZodType<T>, input?: AgentApiRequest): Promise<T>;
}

export class AgentApiClient implements AgentApiRequester {
    constructor(
        private readonly context: AgentContext,
        private readonly fetcher: typeof fetch = fetch
    ) {}

    async request<T>(route: string, schema: z.ZodType<T>, input: AgentApiRequest = {}): Promise<T> {
        const url = new URL(route, this.context.serverUrl);
        for (const [name, value] of Object.entries(input.query ?? {})) {
            if (value !== undefined) {
                url.searchParams.set(name, String(value));
            }
        }
        let response: Response;
        try {
            response = await this.fetcher(url, {
                ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
                headers: {
                    authorization: `Bearer ${this.context.token}`,
                    ...(input.body === undefined ? {} : { 'content-type': 'application/json' }),
                },
                method: input.method ?? 'GET',
                signal: input.signal
                    ? AbortSignal.any([input.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
                    : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
        } catch {
            throw serverFailure();
        }
        if (response.status >= 500) {
            throw serverFailure();
        }
        const payload = await readJson(response);
        if (!response.ok) {
            const parsedError = errorResponseSchema.safeParse(payload);
            if (!parsedError.success) {
                throw invalidJson();
            }
            throw new AgentCliError(parsedError.data.code, parsedError.data.message, {
                draftSaved: parsedError.data.draftSaved,
                nextAction: parsedError.data.nextAction,
            });
        }
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
            throw invalidJson();
        }
        return parsed.data;
    }
}

export function createAgentApiClient(): AgentApiClient {
    return new AgentApiClient(resolveAgentContext());
}

async function readJson(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        throw invalidJson();
    }
}

function invalidJson(): AgentCliError {
    return new AgentCliError('INVALID_JSON_RESPONSE', 'The server returned invalid JSON.', {
        nextAction: 'Retry the command. If it fails again, check the Grotto Computer logs.',
    });
}

function serverFailure(): AgentCliError {
    return new AgentCliError('SERVER_5XX', 'The Grotto server is unavailable.', {
        nextAction: 'Retry after the Grotto Server is reachable.',
    });
}
