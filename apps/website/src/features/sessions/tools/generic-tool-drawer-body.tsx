import { ToolDrawerMonoBlock, ToolDrawerSectionLabel } from './tool-drawer-blocks.tsx';
import type { ToolDrawerCall } from './tool-drawer-call.ts';

export function GenericToolDrawerBody({ call }: { call: ToolDrawerCall }) {
    const argumentEntries = Object.entries(call.arguments);
    const resultText = formatResultText(call.result);

    return (
        <div className="space-y-5">
            {argumentEntries.length > 0 ? (
                <div>
                    <ToolDrawerSectionLabel>Arguments</ToolDrawerSectionLabel>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg border border-border-subtle bg-legacy-muted px-3.5 py-3">
                        {argumentEntries.map(([key, value]) => (
                            <ArgumentRow key={key} name={key} value={value} />
                        ))}
                    </div>
                </div>
            ) : null}
            {resultText ? (
                <div>
                    <ToolDrawerSectionLabel>Result</ToolDrawerSectionLabel>
                    <ToolDrawerMonoBlock
                        className="max-h-96"
                        copyLabel="Copy result"
                        text={resultText}
                    />
                </div>
            ) : null}
        </div>
    );
}

function ArgumentRow({ name, value }: { name: string; value: unknown }) {
    return (
        <>
            <span className="pt-px text-muted-foreground text-sm">{name}</span>
            <span className="whitespace-pre-wrap break-words font-mono text-foreground text-sm leading-relaxed">
                {formatArgumentValue(value)}
            </span>
        </>
    );
}

// Values render as plain text (no JSON quoting); nested values fall back to
// pretty-printed JSON.
function formatArgumentValue(value: unknown) {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    if (value === null || typeof value === 'undefined') {
        return '—';
    }

    return safeStringify(value);
}

function formatResultText(result: unknown) {
    if (typeof result === 'string') {
        return result.length > 0 ? result : null;
    }

    if (result === null || typeof result === 'undefined') {
        return null;
    }

    return safeStringify(result);
}

function safeStringify(value: unknown) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}
