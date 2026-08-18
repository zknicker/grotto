import type { HugeiconsIconProps } from '@hugeicons/react';
import { CommandLineIcon, FileSearchIcon, ToolsIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { ReactNode } from 'react';
import { FileToolDrawerBody } from './file-tool-drawer-body.tsx';
import { GenericToolDrawerBody } from './generic-tool-drawer-body.tsx';
import { TerminalToolDrawerBody } from './terminal-tool-drawer-body.tsx';
import type { ToolDrawerCall } from './tool-drawer-call.ts';

export type ToolDrawerBodyRenderer = (props: { call: ToolDrawerCall }) => ReactNode;

// Tool-aware drawer bodies, resolved by tool name: exact match first, then
// substring match, then the generic fallback. To register a custom drawer
// body for a business-specific tool, add one entry here, e.g.
// `invoice_lookup: InvoiceLookupDrawerBody`.
const toolDrawerBodyRenderers = {
    bash: TerminalToolDrawerBody,
    command: TerminalToolDrawerBody,
    exec: TerminalToolDrawerBody,
    grep: FileToolDrawerBody,
    read: FileToolDrawerBody,
    search: FileToolDrawerBody,
    shell: TerminalToolDrawerBody,
    terminal: TerminalToolDrawerBody,
    zsh: TerminalToolDrawerBody,
} satisfies Record<string, ToolDrawerBodyRenderer>;

export function resolveToolDrawerBody(name: string): ToolDrawerBodyRenderer {
    const normalized = name.trim().toLowerCase();
    const exact = toolDrawerBodyRenderers[normalized as keyof typeof toolDrawerBodyRenderers];

    if (exact) {
        return exact;
    }

    for (const [key, renderer] of Object.entries(toolDrawerBodyRenderers)) {
        if (normalized.includes(key)) {
            return renderer;
        }
    }

    return GenericToolDrawerBody;
}

export function resolveToolDrawerIcon(name: string): HugeiconsIconProps['icon'] {
    const renderer = resolveToolDrawerBody(name);

    if (renderer === TerminalToolDrawerBody) {
        return CommandLineIcon;
    }

    if (renderer === FileToolDrawerBody) {
        return FileSearchIcon;
    }

    return ToolsIcon;
}
