import { ChatTool } from '@heroui-pro/react/chat-tool';
import { formatToolDuration } from '../sessions/tools/tool-ui.ts';
import { TurnTraceNote } from './turn-trace-blocks.tsx';
import { TurnTraceToolBody } from './turn-trace-tool-bodies.tsx';
import type { TurnTraceTool } from './turn-trace-tool-model.ts';
import { clampTraceValue, formatTraceValue } from './turn-trace-values.ts';

/**
 * One tool call in the trace. The row states the verb and its target; the body
 * is whatever that kind of call actually produced. Failures open on their own
 * because they are why someone opened the trace.
 */
export function TurnTraceToolCall({ tool }: { tool: TurnTraceTool }) {
    const duration = formatToolDuration(tool.source.startedAt, tool.source.endedAt ?? null);
    const errorText =
        tool.error === undefined ? null : formatTraceValue(clampTraceValue(tool.error));

    return (
        <ChatTool
            defaultExpanded={tool.state === 'output-error'}
            state={tool.state}
            toolName={tool.source.toolName}
        >
            <ChatTool.Trigger>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                    <ChatTool.StatusIcon />
                    <span className="min-w-0 truncate text-left">{tool.label}</span>
                </span>
                {duration ? (
                    <span className="shrink-0 font-mono text-muted text-xs tabular-nums">
                        {duration}
                    </span>
                ) : null}
            </ChatTool.Trigger>
            <ChatTool.Content>
                <TurnTraceToolBody tool={tool} />
                {tool.preliminary === undefined ? null : (
                    <ChatTool.Result
                        label="Preliminary output"
                        value={clampTraceValue(tool.preliminary)}
                    />
                )}
                {tool.interruption ? <TurnTraceNote>{tool.interruption}</TurnTraceNote> : null}
                {errorText ? <ChatTool.Error errorText={errorText} /> : null}
            </ChatTool.Content>
        </ChatTool>
    );
}
