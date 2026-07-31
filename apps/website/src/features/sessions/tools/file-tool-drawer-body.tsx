import { GenericToolDrawerBody } from './generic-tool-drawer-body.tsx';
import { ToolDrawerMonoBlock, ToolDrawerSectionLabel } from './tool-drawer-blocks.tsx';
import { readToolCallString, readToolResultText, type ToolDrawerCall } from './tool-drawer-call.ts';

export function FileToolDrawerBody({ call }: { call: ToolDrawerCall }) {
    const path =
        readToolCallString(call.arguments.path) ??
        readToolCallString(call.arguments.file) ??
        readToolCallString(call.arguments.file_path) ??
        readToolCallString(call.arguments.filePath);
    const pattern =
        readToolCallString(call.arguments.pattern) ?? readToolCallString(call.arguments.query);
    const content = readToolResultText(call.result);

    if (!(path || pattern || content)) {
        return <GenericToolDrawerBody call={call} />;
    }

    return (
        <div className="space-y-5">
            {path || pattern ? (
                <div>
                    <ToolDrawerSectionLabel>{path ? 'Path' : 'Pattern'}</ToolDrawerSectionLabel>
                    <ToolDrawerMonoBlock
                        copyLabel={path ? 'Copy path' : 'Copy pattern'}
                        text={path ?? pattern ?? ''}
                    />
                    {path && pattern ? (
                        <p className="mt-1.5 truncate font-mono text-muted/70 text-xs">
                            pattern: {pattern}
                        </p>
                    ) : null}
                </div>
            ) : null}
            {content ? (
                <div>
                    <ToolDrawerSectionLabel>Content</ToolDrawerSectionLabel>
                    <ToolDrawerMonoBlock
                        className="max-h-96"
                        copyLabel="Copy content"
                        text={content}
                    />
                </div>
            ) : null}
        </div>
    );
}
