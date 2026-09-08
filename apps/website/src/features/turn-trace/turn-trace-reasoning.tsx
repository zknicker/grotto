import type { AgentExecutionJournalReasoning } from '@grotto/api';
import { ChainOfThought } from '@heroui-pro/react';
import { ReferenceMarkdown } from '../mentions/reference-markdown.tsx';
import { formatToolDuration } from '../sessions/tools/tool-ui.ts';
import {
    readReasoningDurationMs,
    readReasoningPresentation,
} from './turn-trace-reasoning-model.ts';

/**
 * One model reasoning block. Collapsed by default: the trigger says what the
 * Agent was working out, and the summary underneath is markdown the model
 * wrote, so it renders through the same safe renderer a message does.
 */
export function TurnTraceReasoning({
    isStreaming,
    reasoning,
}: {
    isStreaming: boolean;
    reasoning: AgentExecutionJournalReasoning;
}) {
    const endedAt = reasoning.endedAt ?? null;
    const presentation = readReasoningPresentation({
        duration: formatToolDuration(reasoning.startedAt, endedAt),
        durationMs: readReasoningDurationMs(reasoning.startedAt, endedAt),
        isStreaming,
        text: reasoning.text,
    });

    return (
        <ChainOfThought isStreaming={isStreaming}>
            <ChainOfThought.Trigger>{presentation.label}</ChainOfThought.Trigger>
            <ChainOfThought.Content>
                <ChainOfThought.Steps>
                    <ChainOfThought.Step>
                        {presentation.formatted ? (
                            <ReferenceMarkdown className="text-muted" content={presentation.body} />
                        ) : (
                            <p className="whitespace-pre-wrap break-words text-muted">
                                {presentation.body}
                            </p>
                        )}
                        {reasoning.truncated ? (
                            <p className="text-muted text-xs">(truncated)</p>
                        ) : null}
                    </ChainOfThought.Step>
                </ChainOfThought.Steps>
            </ChainOfThought.Content>
        </ChainOfThought>
    );
}
