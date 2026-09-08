import { mcpIconMaxBytes } from '@grotto/api';
import { type EffectRuntime, settle } from '@grotto/effect';
import { Effect } from 'effect';
import { McpIconIoError, mcpFailureKind } from './errors.ts';

export type McpIconFetch = (url: string, signal: AbortSignal) => Promise<Response>;

export async function loadRemoteIcon(
    runtime: EffectRuntime<never>,
    input: {
        encode(bytes: Uint8Array, mediaType: string | null): string | null;
        fetchImpl: McpIconFetch;
        timeoutMs: number;
        url: null | string;
    }
): Promise<string | null> {
    if (!input.url) {
        return null;
    }
    const request = { fetchImpl: input.fetchImpl, url: input.url };
    const load = Effect.acquireUseRelease(
        Effect.sync(() => new AbortController()),
        (controller) => loadResponse(request, controller, input.encode),
        (controller) => Effect.sync(() => controller.abort())
    ).pipe(
        Effect.timeoutTo({
            duration: input.timeoutMs,
            onSuccess: (result) => result,
            onTimeout: () => null,
        }),
        Effect.catchTag('McpIconIoError', (error) =>
            logIconIoFailure('MCP icon request failed; skipping icon.', error).pipe(Effect.as(null))
        )
    );
    return await settle(runtime, load, { onInterrupted: () => null });
}

function loadResponse(
    input: { fetchImpl: McpIconFetch; url: string },
    controller: AbortController,
    encode: (bytes: Uint8Array, mediaType: string | null) => string | null
) {
    return Effect.tryPromise({
        catch: (cause) => new McpIconIoError({ cause, operation: 'mcp.icon.fetch' }),
        try: () => input.fetchImpl(input.url, controller.signal),
    }).pipe(
        Effect.flatMap((response) => inspectResponse(response)),
        Effect.flatMap((response) =>
            response.ok
                ? readCappedBody(response.body, response.contentLength, controller).pipe(
                      Effect.map((bytes) => (bytes ? encode(bytes, response.mediaType) : null))
                  )
                : Effect.succeed(null)
        )
    );
}

function inspectResponse(response: Response): Effect.Effect<IconResponse, McpIconIoError> {
    return Effect.try({
        catch: (cause) => new McpIconIoError({ cause, operation: 'mcp.icon.response.inspect' }),
        try: () => ({
            body: response.body,
            contentLength: response.headers.get('content-length'),
            mediaType: response.headers.get('content-type'),
            ok: response.ok,
        }),
    });
}

function readCappedBody(
    body: ReadableStream<Uint8Array> | null,
    contentLength: string | null,
    controller: AbortController
): Effect.Effect<Uint8Array | null, McpIconIoError> {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > mcpIconMaxBytes) {
        controller.abort();
        return Effect.succeed(null);
    }
    if (!body) {
        return Effect.succeed(null);
    }
    return Effect.acquireUseRelease(
        Effect.try({
            catch: (cause) => new McpIconIoError({ cause, operation: 'mcp.icon.reader.acquire' }),
            try: () => body.getReader(),
        }),
        (reader) => readChunks(reader, controller),
        (reader) => releaseReader(reader, controller)
    );
}

interface IconResponse {
    readonly body: ReadableStream<Uint8Array> | null;
    readonly contentLength: string | null;
    readonly mediaType: string | null;
    readonly ok: boolean;
}

function releaseReader(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    controller: AbortController
) {
    return Effect.sync(() => controller.abort()).pipe(
        Effect.zipRight(
            Effect.tryPromise({
                catch: (cause) =>
                    new McpIconIoError({ cause, operation: 'mcp.icon.reader.cancel' }),
                try: () => reader.cancel(),
            }).pipe(
                Effect.catchTag('McpIconIoError', (error) =>
                    logIconIoFailure('MCP icon cleanup failed; continuing.', error)
                )
            )
        ),
        Effect.ensuring(
            Effect.try({
                catch: (cause) =>
                    new McpIconIoError({ cause, operation: 'mcp.icon.reader.release' }),
                try: () => reader.releaseLock(),
            }).pipe(
                Effect.catchTag('McpIconIoError', (error) =>
                    logIconIoFailure('MCP icon cleanup failed; continuing.', error)
                )
            )
        )
    );
}

function readChunks(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    controller: AbortController
): Effect.Effect<Uint8Array | null, McpIconIoError> {
    const chunks: Uint8Array[] = [];
    let total = 0;
    return Effect.gen(function* () {
        for (;;) {
            const { done, value } = yield* Effect.tryPromise({
                catch: (cause) => new McpIconIoError({ cause, operation: 'mcp.icon.reader.read' }),
                try: () => reader.read(),
            });
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
        return concatenateBytes(chunks, total);
    });
}

function logIconIoFailure(message: string, error: McpIconIoError) {
    return Effect.logWarning(message).pipe(
        Effect.annotateLogs({
            failureKind: mcpFailureKind(error.cause),
            operation: error.operation,
        })
    );
}

function concatenateBytes(chunks: Uint8Array[], total: number): Uint8Array {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}
