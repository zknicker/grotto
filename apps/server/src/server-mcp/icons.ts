import { type McpIcon, mcpIconMaxBytes, mcpIconSchema, mcpSummarySchema } from '@tavern/api';
import * as z from 'zod';

/**
 * Resolving a connection's icon to inline bytes, at discovery time.
 *
 * Two sources, in order: the icons an MCP server advertises in `serverInfo`
 * (SEP-973), then the favicon of the site behind its host. Both are fetched
 * here, by Grotto Server, once per refresh — never by the App. An `img` in the
 * App pointed at a connection's own host would report the viewer's IP and page
 * views back to that operator, which is exactly the tracking channel this
 * module exists to close.
 *
 * The upstream `Icon` shape stays local to this file: it is a third-party
 * protocol shape, not a Grotto contract. What crosses `@tavern/api` is the
 * validated, inlined result.
 */

/** The MCP spec's icon metadata. `sizes` is `"48x48"`-style, or `"any"`. */
const upstreamIconSchema = z
    .object({
        mimeType: z.string().optional(),
        sizes: z.array(z.string()).optional(),
        src: z.string(),
        theme: z.enum(['dark', 'light']).optional(),
    })
    .loose();

type UpstreamIcon = z.infer<typeof upstreamIconSchema>;

const upstreamIconsSchema = z.array(upstreamIconSchema).max(24);

/** Rows render around 32px; at 2x DPR anything from 64px up is plenty. */
const preferredMinimumPixels = 64;

/**
 * Raster only. SVG is the one format that can carry script or pull
 * subresources, and screening it needs a parser rather than a token blocklist —
 * so it is refused outright and such a server falls through to its favicon.
 */
const iconMediaTypes = new Map<string, string>([
    ['image/jpeg', 'image/jpeg'],
    ['image/jpg', 'image/jpeg'],
    ['image/png', 'image/png'],
    ['image/vnd.microsoft.icon', 'image/x-icon'],
    ['image/webp', 'image/webp'],
    ['image/x-icon', 'image/x-icon'],
]);

/** Hosts prefixed with a service label usually front a site that has a favicon. */
const serviceHostLabels = new Set(['api', 'connect', 'mcp', 'remote', 'server']);

export type McpIconFetch = (url: string, signal: AbortSignal) => Promise<Response>;

export async function resolveMcpIcon(input: {
    connectionUrl: string;
    fetchImpl?: McpIconFetch;
    serverInfoIcons: unknown;
    timeoutMs: number;
}): Promise<McpIcon | null> {
    const fetchImpl = input.fetchImpl ?? defaultIconFetch;
    const advertised = await resolveAdvertisedIcon({ ...input, fetchImpl });
    if (advertised) {
        return advertised;
    }
    const favicon = await loadIconBytes({
        fetchImpl,
        timeoutMs: input.timeoutMs,
        url: siteFaviconUrl(input.connectionUrl),
    });
    return favicon ? asIcon({ dark: favicon, light: favicon }) : null;
}

async function resolveAdvertisedIcon(input: {
    connectionUrl: string;
    fetchImpl: McpIconFetch;
    serverInfoIcons: unknown;
    timeoutMs: number;
}): Promise<McpIcon | null> {
    const parsed = upstreamIconsSchema.safeParse(input.serverInfoIcons);
    if (!parsed.success || parsed.data.length === 0) {
        return null;
    }
    // An untagged icon sits in both theme buckets; without this it would be
    // fetched once per bucket.
    const loads = new Map<string, Promise<string | null>>();
    const context = { ...input, loads };
    const [light, dark] = await Promise.all([
        loadVariant(parsed.data, 'light', context),
        loadVariant(parsed.data, 'dark', context),
    ]);
    return asIcon({ dark: dark ?? light, light: light ?? dark });
}

async function loadVariant(
    icons: UpstreamIcon[],
    theme: 'dark' | 'light',
    input: {
        connectionUrl: string;
        fetchImpl: McpIconFetch;
        loads: Map<string, Promise<string | null>>;
        timeoutMs: number;
    }
): Promise<string | null> {
    // An untagged icon serves both themes, so it stays in every bucket.
    const candidates = rankIcons(icons.filter((icon) => (icon.theme ?? theme) === theme));
    for (const candidate of candidates) {
        const pending =
            input.loads.get(candidate.src) ??
            (candidate.src.startsWith('data:')
                ? Promise.resolve(readDataUrl(candidate.src))
                : loadIconBytes({
                      fetchImpl: input.fetchImpl,
                      timeoutMs: input.timeoutMs,
                      url: sameOriginIconUrl(candidate.src, input.connectionUrl),
                  }));
        input.loads.set(candidate.src, pending);
        const loaded = await pending;
        if (loaded) {
            return loaded;
        }
    }
    return null;
}

/**
 * Smallest that still covers a retina row, first. Candidates declaring a media
 * type we do not accept are dropped here rather than fetched and rejected —
 * an SVG-only server should cost zero requests, not one per theme.
 */
function rankIcons(icons: UpstreamIcon[]): UpstreamIcon[] {
    return icons
        .filter((icon) => !icon.mimeType || iconMediaTypes.has(icon.mimeType.toLowerCase()))
        .sort((left, right) => iconRank(left) - iconRank(right));
}

function iconRank(icon: UpstreamIcon): number {
    const pixels = largestDeclaredPixels(icon);
    if (pixels === 'any') {
        return 0;
    }
    if (pixels === null) {
        return 2;
    }
    return pixels >= preferredMinimumPixels ? 1 + pixels / 100_000 : 3 - pixels / 100_000;
}

function largestDeclaredPixels(icon: UpstreamIcon): 'any' | null | number {
    if (!icon.sizes || icon.sizes.length === 0) {
        return null;
    }
    if (icon.sizes.some((size) => size.trim().toLowerCase() === 'any')) {
        return 'any';
    }
    const widths = icon.sizes
        .map((size) => Number.parseInt(size.trim().toLowerCase().split('x')[0] ?? '', 10))
        .filter((width) => Number.isFinite(width) && width > 0);
    return widths.length > 0 ? Math.max(...widths) : null;
}

/**
 * An icon URL is chosen by the remote server, which is a lower trust class than
 * the operator-configured connection URL. Restricting it to the connection's own
 * origin removes the SSRF surface outright; servers that host icons elsewhere
 * simply fall through to the favicon step.
 */
function sameOriginIconUrl(src: string, connectionUrl: string): null | string {
    try {
        const icon = new URL(src);
        const connection = new URL(connectionUrl);
        if (icon.protocol !== 'https:' || icon.origin !== connection.origin) {
            return null;
        }
        return icon.toString();
    } catch {
        return null;
    }
}

/**
 * MCP endpoints are API hosts, not websites: of six real remote MCP servers
 * checked, one served a favicon at its own origin while four served one from
 * the site behind it (`mcp.linear.app` -> `linear.app`).
 *
 * This is a heuristic, not a public-suffix lookup. Testing the leading label
 * happens to leave `example.co.uk` alone, but a connection on a shared
 * platform host (`mcp.vercel.app`, `api.onrender.com`) will strip to the
 * platform apex and show the platform's mark. Harmless — a public favicon,
 * no user data — but wrong, and the fix would be a real suffix list.
 */
export function siteFaviconUrl(connectionUrl: string): null | string {
    try {
        const { hostname, protocol } = new URL(connectionUrl);
        if (protocol !== 'https:') {
            return null;
        }
        const labels = hostname.split('.');
        const site =
            labels.length > 2 && serviceHostLabels.has(labels[0])
                ? labels.slice(1).join('.')
                : hostname;
        return `https://${site}/favicon.ico`;
    } catch {
        return null;
    }
}

async function loadIconBytes(input: {
    fetchImpl: McpIconFetch;
    timeoutMs: number;
    url: null | string;
}): Promise<string | null> {
    if (!input.url) {
        return null;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
        const response = await input.fetchImpl(input.url, controller.signal);
        if (!response.ok) {
            return null;
        }
        const mediaType = normalizeMediaType(response.headers.get('content-type'));
        if (!mediaType) {
            return null;
        }
        const bytes = await readCappedBody(response, controller);
        return bytes ? encodeIcon(bytes, mediaType) : null;
    } catch {
        // An icon is decoration; a slow or hostile host must not fail discovery.
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Reads at most the icon ceiling. Buffering the whole body first would let a
 * hostile host stream unbounded bytes into Server memory before the size check
 * ever ran, so the cap is enforced against the stream and the response is
 * aborted the moment it is exceeded.
 */
async function readCappedBody(
    response: Response,
    controller: AbortController
): Promise<Uint8Array | null> {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > mcpIconMaxBytes) {
        controller.abort();
        return null;
    }
    const body = response.body;
    if (!body) {
        return null;
    }
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            total += value.byteLength;
            if (total > mcpIconMaxBytes) {
                controller.abort();
                return null;
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

function readDataUrl(src: string): string | null {
    const match = /^data:([^;,]+);base64,(.*)$/su.exec(src);
    if (!match) {
        return null;
    }
    const mediaType = normalizeMediaType(match[1]);
    try {
        return encodeIcon(Uint8Array.from(Buffer.from(match[2] ?? '', 'base64')), mediaType);
    } catch {
        return null;
    }
}

function encodeIcon(bytes: Uint8Array, mediaType: null | string): string | null {
    if (!mediaType || bytes.byteLength === 0 || bytes.byteLength > mcpIconMaxBytes) {
        return null;
    }
    const resolved = rasterMediaType(bytes);
    if (!resolved || resolved !== mediaType) {
        return null;
    }
    return `data:${resolved};base64,${Buffer.from(bytes).toString('base64')}`;
}

/** The declared type has to match the bytes, or the icon is discarded. */
function rasterMediaType(bytes: Uint8Array): null | string {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return 'image/png';
    }
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
        return 'image/jpeg';
    }
    if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && readAscii(bytes, 8, 4) === 'WEBP') {
        return 'image/webp';
    }
    if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) {
        return 'image/x-icon';
    }
    return null;
}

function normalizeMediaType(value: null | string | undefined): null | string {
    if (!value) {
        return null;
    }
    return iconMediaTypes.get(value.split(';')[0]?.trim().toLowerCase() ?? '') ?? null;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
    return (
        bytes.byteLength >= signature.length &&
        signature.every((byte, index) => bytes[index] === byte)
    );
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
    return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function asIcon(candidate: { dark: null | string; light: null | string }): McpIcon | null {
    // One icon serving both themes is stored once; the App falls back to the
    // light variant. `mcp.list` returns every connection's icon inline, so
    // storing the same bytes twice would double that payload for no gain.
    const deduped =
        candidate.dark === candidate.light ? { dark: null, light: candidate.light } : candidate;
    const parsed = mcpIconSchema.safeParse(deduped);
    return parsed.success ? parsed.data : null;
}

/**
 * Redirects are refused rather than followed: a same-origin icon URL that
 * bounces elsewhere would defeat the origin check that keeps this fetch from
 * becoming an SSRF probe. Exported so a test can pin it.
 */
export const iconRequestInit = { redirect: 'error' } as const satisfies RequestInit;

async function defaultIconFetch(url: string, signal: AbortSignal): Promise<Response> {
    return await globalThis.fetch(url, { ...iconRequestInit, signal });
}

/**
 * The opening line of a server's `instructions`, as its description.
 *
 * `instructions` is written for a model — DeepWiki returns a 2,500-character
 * catalog of every tool it offers. The first line is the part that reads as a
 * description to a person; anything past it is guidance, not identity.
 */
export function summarizeInstructions(instructions: unknown): string | null {
    if (typeof instructions !== 'string') {
        return null;
    }
    const firstLine = instructions
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0);
    if (!firstLine) {
        return null;
    }
    const parsed = mcpSummarySchema.safeParse(
        firstLine.length > 200 ? `${firstLine.slice(0, 199).trimEnd()}…` : firstLine
    );
    return parsed.success ? parsed.data : null;
}
