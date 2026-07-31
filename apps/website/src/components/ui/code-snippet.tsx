'use client';

import { Tick02Icon } from '@hugeicons-pro/core-solid-rounded';
import { Copy01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { writeClipboardText } from '../../lib/clipboard.ts';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';
import { Button } from './primitives/button.tsx';

interface CodeSnippetProps extends Omit<React.ComponentProps<'div'>, 'children'> {
    copyValue?: string;
    lines: string | string[];
}

export function CodeSnippet({ className, copyValue, lines, ...props }: CodeSnippetProps) {
    const [copied, setCopied] = React.useState(false);
    const normalizedLines = Array.isArray(lines) ? lines : [lines];
    const isMultiLine = normalizedLines.length > 1;
    const value = copyValue ?? normalizedLines.join('\n');
    const canCopy = value.length > 0;

    React.useEffect(() => {
        if (!copied) {
            return;
        }

        const id = window.setTimeout(() => setCopied(false), 1600);
        return () => window.clearTimeout(id);
    }, [copied]);

    return (
        <div
            className={cn(
                'flex min-w-0 gap-2 rounded-lg bg-legacy-muted ps-3 pe-1 font-mono text-foreground text-sm',
                isMultiLine ? 'items-start py-1.5' : 'h-8 items-center',
                className
            )}
            {...props}
        >
            <code
                className={cn(
                    'min-w-0 flex-1 overflow-x-auto',
                    isMultiLine ? 'whitespace-pre-wrap break-all' : 'whitespace-nowrap'
                )}
            >
                {normalizedLines.join('\n')}
            </code>
            <Button
                aria-label={copied ? 'Copied' : 'Copy code'}
                className="text-muted-foreground hover:text-foreground"
                disabled={!canCopy}
                onClick={async () => {
                    try {
                        await writeClipboardText(value);
                        setCopied(true);
                    } catch {
                        setCopied(false);
                    }
                }}
                size="icon-xs"
                variant="ghost"
            >
                <Icon icon={copied ? Tick02Icon : Copy01Icon} />
            </Button>
        </div>
    );
}
