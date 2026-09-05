import { type CloudAgentPullRequest, cloudAgentPullRequestSchema } from '@grotto/api';
import { githubToken } from './token.ts';

/**
 * The Computer's own GitHub reading of a pull request a Run opened. Cursor's
 * public Cloud Agents API reports no diff statistics, so the one place that
 * fact exists is GitHub, and the Computer is the layer that already holds
 * provider access. What crosses to Server is the bounded snapshot on the Run's
 * branch evidence — never the token, the diff, or anything else GitHub returns.
 *
 * Every failure is the same answer: no snapshot. A pull request that cannot be
 * read must never fail a Run observation, so the reader resolves `null` and
 * logs one debug line instead of throwing.
 */

/** One GitHub read is bounded; a Run observation waits for nothing longer. */
const defaultTimeoutMs = 4000;
/** At most one read per pull request per window, however often a Run reports. */
const defaultThrottleMs = 30_000;

/** Only the one call this reader makes; Bun's `fetch` carries more than that. */
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface PullRequestAddress {
    number: number;
    owner: string;
    repo: string;
}

export interface PullRequestReader {
    read(pullRequestUrl: string): Promise<CloudAgentPullRequest | null>;
}

export interface PullRequestReaderOptions {
    fetch?: FetchLike;
    now?: () => number;
    onDebug?: (message: string) => void;
    throttleMs?: number;
    timeoutMs?: number;
    token?: () => Promise<string | null>;
}

export function createPullRequestReader(options: PullRequestReaderOptions = {}): PullRequestReader {
    // Late-bound, so a Computer (or a test) that replaces `fetch` is honored.
    const request: FetchLike = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
    const now = options.now ?? Date.now;
    const debug = options.onDebug ?? ((message: string) => console.debug(message));
    const throttleMs = options.throttleMs ?? defaultThrottleMs;
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    const token = options.token ?? (() => githubToken());
    const cached = new Map<string, { at: number; snapshot: CloudAgentPullRequest | null }>();

    return {
        async read(pullRequestUrl: string): Promise<CloudAgentPullRequest | null> {
            const address = pullRequestAddressOf(pullRequestUrl);
            if (!address) {
                return null;
            }
            const key = `${address.owner}/${address.repo}#${address.number}`;
            const entry = cached.get(key);
            if (entry && now() - entry.at < throttleMs) {
                return entry.snapshot;
            }
            const snapshot = await readSnapshot(address).catch((error: unknown) => {
                debug(`GitHub pull request ${key} could not be read: ${messageOf(error)}`);
                return null;
            });
            cached.set(key, { at: now(), snapshot });
            return snapshot;
        },
    };

    /** One read, retried once on a 5xx because that is GitHub having a moment. */
    async function readSnapshot(
        address: PullRequestAddress
    ): Promise<CloudAgentPullRequest | null> {
        const first = await fetchPullRequest(address);
        const payload = first.retryable ? (await fetchPullRequest(address)).payload : first.payload;
        return payload ? pullRequestOf(payload, new Date(now()).toISOString()) : null;
    }

    async function fetchPullRequest(
        address: PullRequestAddress
    ): Promise<{ payload: unknown; retryable: boolean }> {
        const authorization = await token();
        const response = await request(
            `https://api.github.com/repos/${encodeURIComponent(address.owner)}/${encodeURIComponent(
                address.repo
            )}/pulls/${address.number}`,
            {
                headers: {
                    accept: 'application/vnd.github+json',
                    ...(authorization ? { authorization: `Bearer ${authorization}` } : {}),
                    'x-github-api-version': '2022-11-28',
                },
                signal: AbortSignal.timeout(timeoutMs),
            }
        );
        if (!response.ok) {
            return { payload: null, retryable: response.status >= 500 };
        }
        return { payload: await response.json(), retryable: false };
    }
}

/**
 * The pull request a URL names, on GitHub only. Cursor may report a branch on
 * any host, but only GitHub's API is read here, so anything else yields no
 * address and therefore no snapshot.
 */
export function pullRequestAddressOf(pullRequestUrl: string): PullRequestAddress | null {
    let url: URL;
    try {
        url = new URL(pullRequestUrl);
    } catch {
        return null;
    }
    const host = url.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') {
        return null;
    }
    const matched = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/u.exec(url.pathname);
    const number = matched ? Number.parseInt(matched[3] as string, 10) : Number.NaN;
    if (!(matched && Number.isSafeInteger(number) && number > 0)) {
        return null;
    }
    return { number, owner: matched[1] as string, repo: matched[2] as string };
}

/**
 * GitHub's own vocabulary as Grotto records it. `merged` outranks `closed`
 * because a merged pull request is also closed, and `draft` outranks `open`
 * because an open draft is not yet asking to be reviewed. A payload missing
 * the diff counts is not a snapshot: reporting zeros would be a lie.
 */
export function pullRequestOf(payload: unknown, observedAt: string): CloudAgentPullRequest | null {
    if (!isRecord(payload)) {
        return null;
    }
    const parsed = cloudAgentPullRequestSchema.safeParse({
        additions: payload.additions,
        changedFiles: payload.changed_files,
        deletions: payload.deletions,
        number: payload.number,
        observedAt,
        state: stateOf(payload),
    });
    return parsed.success ? parsed.data : null;
}

function stateOf(payload: Record<string, unknown>): string {
    if (payload.merged === true || typeof payload.merged_at === 'string') {
        return 'merged';
    }
    if (payload.state === 'closed') {
        return 'closed';
    }
    return payload.draft === true ? 'draft' : 'open';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
