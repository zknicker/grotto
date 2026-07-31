import { parseToolRecord } from './tool-detail-value.ts';
import { ToolDrawerMonoBlock, ToolDrawerSectionLabel } from './tool-drawer-blocks.tsx';
import { readToolCallString, readToolResultText, type ToolDrawerCall } from './tool-drawer-call.ts';

export function TerminalToolDrawerBody({ call }: { call: ToolDrawerCall }) {
    const command =
        readToolCallString(call.arguments.command) ??
        readToolCallString(call.arguments.cmd) ??
        call.label;
    const workdir =
        readToolCallString(call.arguments.workdir) ?? readToolCallString(call.arguments.cwd);
    const output = readToolResultText(call.result);
    const resultRecord = parseToolRecord(call.result);
    const exitCode = typeof resultRecord?.exitCode === 'number' ? resultRecord.exitCode : null;
    const errorText = readToolCallString(resultRecord?.error);

    return (
        <div className="space-y-5">
            {command ? (
                <div>
                    <ToolDrawerSectionLabel>Command</ToolDrawerSectionLabel>
                    <ToolDrawerMonoBlock copyLabel="Copy command" text={`$ ${command}`} />
                    {workdir ? (
                        <p className="mt-1.5 truncate font-mono text-muted/70 text-xs">{workdir}</p>
                    ) : null}
                </div>
            ) : null}
            {output ? (
                <div>
                    <ToolDrawerSectionLabel>Output</ToolDrawerSectionLabel>
                    <ToolDrawerMonoBlock
                        className="max-h-96"
                        copyLabel="Copy output"
                        text={output}
                    />
                </div>
            ) : null}
            {(exitCode !== null && exitCode !== 0) || errorText ? (
                <div className="space-y-1">
                    {exitCode !== null && exitCode !== 0 ? (
                        <p className="font-mono text-danger text-sm">exit {exitCode}</p>
                    ) : null}
                    {errorText ? (
                        <p className="whitespace-pre-wrap break-words font-mono text-danger/90 text-sm">
                            {errorText}
                        </p>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
