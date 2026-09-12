import type { AgentReasoningEffort } from '@haus/api';
import type { TelemetryAttributes } from '@haus/effect';

type TurnMilestone = 'harness_ready' | 'first_stream' | 'first_tool';
type TurnPhase = 'bootstrap' | 'session_create';

/** Monotonic, request-local measurements; never part of the durable turn protocol. */
export class AgentTurnTimings {
    private readonly startedAt: number;
    private readonly attributes: {
        -readonly [K in keyof TelemetryAttributes]: TelemetryAttributes[K];
    } = {};
    private lastSendAt: number | undefined;

    constructor(private readonly now: () => number = () => performance.now()) {
        this.startedAt = now();
    }

    setReasoningEffort(effort: AgentReasoningEffort): void {
        this.attributes['haus.reasoning.effort'] = effort;
    }

    mark(milestone: TurnMilestone): void {
        const key = `haus.turn.${milestone}_ms` as const;
        this.attributes[key] ??= this.elapsed();
    }

    async measure<A>(phase: TurnPhase, operation: () => Promise<A>): Promise<A> {
        const startedAt = this.now();
        try {
            return await operation();
        } finally {
            const key = `haus.turn.${phase}_ms` as const;
            const previous = this.attributes[key];
            this.attributes[key] =
                (typeof previous === 'number' ? previous : 0) + this.now() - startedAt;
        }
    }

    recordSend(): void {
        this.lastSendAt = this.now();
        this.attributes['haus.turn.first_send_ms'] ??= this.lastSendAt - this.startedAt;
        this.attributes['haus.turn.last_send_ms'] = this.lastSendAt - this.startedAt;
    }

    snapshot(): TelemetryAttributes {
        return {
            ...this.attributes,
            ...(this.lastSendAt === undefined
                ? {}
                : { 'haus.turn.after_last_send_ms': this.now() - this.lastSendAt }),
        };
    }

    private elapsed(): number {
        return this.now() - this.startedAt;
    }
}
