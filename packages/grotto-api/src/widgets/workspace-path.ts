import * as z from 'zod';

/**
 * Path shape for widgets that render an agent-authored workspace file
 * (artifact). Fence props are attacker-controlled: this schema
 * enforces shape only (workspace-relative path, confined segments, extension
 * allowlist). Real confinement happens where the file is read — the Runtime
 * workspace file read resolves the path against the sending agent's workspace
 * root with realpath checks, secret-file blocks, and size caps.
 */
export function workspaceFilePathSchema(extension: RegExp, extensionMessage: string) {
    return z
        .string()
        .trim()
        .min(1)
        .max(512)
        .refine((value) => !(value.startsWith('/') || value.includes('\\')), {
            message: 'Path must be workspace-relative and use forward slashes.',
        })
        .refine(
            (value) =>
                value
                    .split('/')
                    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..'),
            { message: 'Path must stay inside the agent workspace.' }
        )
        .refine((value) => extension.test(value), { message: extensionMessage });
}

export const workspaceWidgetHeight = { default: 480, max: 1200, min: 120 } as const;

export const clampedWorkspaceWidgetHeightSchema = z
    .number()
    .finite()
    .transform((value) =>
        Math.round(Math.min(workspaceWidgetHeight.max, Math.max(workspaceWidgetHeight.min, value)))
    );
