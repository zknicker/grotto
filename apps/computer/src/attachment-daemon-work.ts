import { AgentWorkCoordinator } from './agent-work-coordinator.ts';
import type { DaemonRuntime } from './daemon-runtime.ts';

export interface AttachmentFrameSender {
    send(frame: unknown): boolean;
}

/** Owns Agent work and response routing for the full attachment-daemon lifetime. */
export class AttachmentDaemonWork {
    readonly agentWork: AgentWorkCoordinator;
    readonly noticeSinks = new Map<
        string,
        { deliver: (notice: string) => Promise<boolean>; runId: string }
    >();
    readonly resettingAgents = new Set<string>();
    readonly retiredAgents = new Set<string>();

    private closePromise: Promise<void> | null = null;
    private closing = false;
    private sender: AttachmentFrameSender | null = null;
    private readonly writers = new Set<Promise<unknown>>();

    constructor(runtime: DaemonRuntime) {
        this.agentWork = new AgentWorkCoordinator(runtime);
    }

    attachSender(sender: AttachmentFrameSender): () => void {
        if (this.closing) {
            return () => undefined;
        }
        this.sender = sender;
        return () => {
            if (this.sender === sender) {
                this.sender = null;
            }
        };
    }

    send(frame: unknown): boolean {
        return this.sender?.send(frame) ?? false;
    }

    track<Result>(operation: Promise<Result>): Promise<Result> {
        if (this.closing) {
            return Promise.reject(new Error('The attachment daemon is shutting down.'));
        }
        this.writers.add(operation);
        operation.then(
            () => this.writers.delete(operation),
            () => this.writers.delete(operation)
        );
        return operation;
    }

    writerSnapshot(): Promise<unknown>[] {
        return [...this.writers];
    }

    close(): Promise<void> {
        if (this.closePromise) {
            return this.closePromise;
        }
        this.closing = true;
        this.sender = null;
        this.agentWork.abortAll();
        this.closePromise = Promise.allSettled(this.writerSnapshot()).then(() => undefined);
        return this.closePromise;
    }
}
