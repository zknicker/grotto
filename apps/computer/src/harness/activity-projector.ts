import type {
    ComputerAgentActivityCategory,
    ComputerAgentActivityUpdate,
} from '../agent-activity.ts';
import type { ComputerExecutionJournal } from './execution-journal.ts';

export interface GrottoHostToolRegistration {
    category: Exclude<ComputerAgentActivityCategory, 'starting_work' | 'thinking' | 'working'>;
    name: string;
    toolRef?: string;
}

export interface ComputerActivityRegistry {
    classify(input: {
        dynamic?: boolean;
        nativeName?: string;
        runtimeId: string;
        toolName: string;
    }): ComputerAgentActivityUpdate & { toolRef?: string };
    registerGrottoHostTool(registration: GrottoHostToolRegistration): void;
}

/** Fixture-shaped native identities kept explicit so adapter renames fail closed. */
export const computerNativeToolActivityFixtures = {
    'claude-code': {
        Bash: 'running_command',
        Edit: 'editing_files',
        Glob: 'reading_files',
        Grep: 'reading_files',
        Read: 'reading_files',
        Write: 'editing_files',
        WebFetch: 'browsing',
        WebSearch: 'searching_web',
        bash: 'running_command',
        edit: 'editing_files',
        glob: 'reading_files',
        grep: 'reading_files',
        read: 'reading_files',
        webSearch: 'searching_web',
    },
    codex: {
        bash: 'running_command',
        shell: 'running_command',
        webSearch: 'searching_web',
        web_search: 'searching_web',
    },
    pi: {
        bash: 'running_command',
        edit: 'editing_files',
        find: 'reading_files',
        grep: 'reading_files',
        ls: 'reading_files',
        read: 'reading_files',
        write: 'editing_files',
    },
} as const satisfies Record<string, Readonly<Record<string, ComputerAgentActivityCategory>>>;

export function createComputerActivityRegistry(): ComputerActivityRegistry {
    const hostTools = new Map<string, GrottoHostToolRegistration>();
    return {
        classify(input) {
            if (input.dynamic || isMcpName(input.toolName) || isMcpName(input.nativeName)) {
                return { category: 'using_tool', phase: 'started' };
            }
            const host = hostTools.get(input.nativeName ?? '') ?? hostTools.get(input.toolName);
            if (host) {
                return {
                    category: host.category,
                    phase: 'started',
                    ...(host.toolRef ? { toolRef: host.toolRef } : {}),
                };
            }
            const known = knownToolCategory(input.runtimeId, input.toolName, input.nativeName);
            return { category: known ?? 'using_tool', phase: 'started' };
        },
        registerGrottoHostTool(registration) {
            hostTools.set(registration.name, registration);
        },
    };
}

export function classifyGrottoProxyBoundary(
    method: string,
    pathname: string
): ComputerAgentActivityCategory | null {
    if (
        (method === 'GET' &&
            (pathname === '/api/agent/events' ||
                pathname === '/api/agent/history' ||
                pathname === '/api/agent/messages/search' ||
                /^\/api\/agent\/messages\/[^/]+$/u.test(pathname))) ||
        (method === 'POST' && pathname === '/api/agent/messages/search')
    ) {
        return 'checking_messages';
    }
    if (/^\/api\/agent\/browser(?:\/|$)/u.test(pathname)) {
        return 'browsing';
    }
    return null;
}

export function createComputerActivityProjector(input: {
    journal?: ComputerExecutionJournal;
    onActivity?: (activity: ComputerAgentActivityUpdate & { toolRef?: string }) => void;
    registry: ComputerActivityRegistry;
    runtimeId: string;
}) {
    const pending = new Map<string, ComputerAgentActivityUpdate & { toolRef?: string }>();
    return {
        async finish(phase: 'completed' | 'failed' | 'interrupted', error?: unknown) {
            if (pending.size > 0) {
                await input.journal?.finishPending(
                    phase === 'interrupted' ? 'interrupted' : 'failed',
                    phase === 'interrupted' ? 'stream_abort' : 'stream_error',
                    error
                );
            }
            if (phase !== 'completed' || pending.size > 0) {
                for (const activity of pending.values()) {
                    emit(input.onActivity, { ...activity, phase: 'failed' });
                }
            }
            pending.clear();
        },
        async observe(part: unknown) {
            if (!isRecord(part) || typeof part.type !== 'string') {
                return;
            }
            if (part.type === 'tool-call') {
                await observeToolCall(part, input, pending);
                return;
            }
            if (part.type === 'tool-result') {
                await observeToolResult(part, input, pending);
                return;
            }
            if (part.type === 'file-change') {
                emit(input.onActivity, { category: 'editing_files', phase: 'started' });
                emit(input.onActivity, { category: 'editing_files', phase: 'completed' });
            }
        },
    };
}

async function observeToolCall(
    part: Record<string, unknown>,
    input: {
        journal?: ComputerExecutionJournal;
        onActivity?: (activity: ComputerAgentActivityUpdate & { toolRef?: string }) => void;
        registry: ComputerActivityRegistry;
        runtimeId: string;
    },
    pending: Map<string, ComputerAgentActivityUpdate & { toolRef?: string }>
) {
    const toolCallId = stringValue(part.toolCallId);
    const toolName = stringValue(part.toolName);
    if (!(toolCallId && toolName)) {
        return;
    }
    const activity = input.registry.classify({
        dynamic: part.dynamic === true,
        nativeName: stringValue(part.nativeName),
        runtimeId: input.runtimeId,
        toolName,
    });
    if (!pending.has(toolCallId)) {
        pending.set(toolCallId, activity);
        emit(input.onActivity, activity);
    }
    await input.journal?.recordToolCall({
        input: part.input,
        nativeName: stringValue(part.nativeName),
        toolCallId,
        toolName,
    });
}

async function observeToolResult(
    part: Record<string, unknown>,
    input: {
        journal?: ComputerExecutionJournal;
        onActivity?: (activity: ComputerAgentActivityUpdate & { toolRef?: string }) => void;
        registry: ComputerActivityRegistry;
        runtimeId: string;
    },
    pending: Map<string, ComputerAgentActivityUpdate & { toolRef?: string }>
) {
    const toolCallId = stringValue(part.toolCallId);
    const toolName = stringValue(part.toolName);
    if (!(toolCallId && toolName)) {
        return;
    }
    const activity =
        pending.get(toolCallId) ??
        input.registry.classify({
            dynamic: part.dynamic === true,
            nativeName: stringValue(part.nativeName),
            runtimeId: input.runtimeId,
            toolName,
        });
    if (!pending.has(toolCallId)) {
        pending.set(toolCallId, activity);
        emit(input.onActivity, activity);
    }
    const isPreliminary = part.preliminary === true;
    await input.journal?.recordToolResult({
        isError: part.isError === true,
        nativeName: stringValue(part.nativeName),
        preliminary: isPreliminary,
        result: part.result,
        toolCallId,
        toolName,
    });
    if (isPreliminary) {
        return;
    }
    pending.delete(toolCallId);
    emit(input.onActivity, {
        ...activity,
        phase: part.isError === true ? 'failed' : 'completed',
    });
}

function knownToolCategory(runtimeId: string, toolName: string, nativeName?: string) {
    const identity = nativeName ?? toolName;
    const commonName = toolName;
    const mapping: Readonly<Record<string, ComputerAgentActivityCategory>> | undefined =
        computerNativeToolActivityFixtures[
            runtimeId as keyof typeof computerNativeToolActivityFixtures
        ];
    return mapping?.[identity] ?? mapping?.[commonName];
}

function emit(
    onActivity:
        | ((activity: ComputerAgentActivityUpdate & { toolRef?: string }) => void)
        | undefined,
    activity: ComputerAgentActivityUpdate & { toolRef?: string }
) {
    onActivity?.(activity);
}

function isMcpName(value: string | undefined): boolean {
    return value?.startsWith('mcp__') ?? false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
