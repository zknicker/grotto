import { AgentCliError } from '../agent-error.ts';
import type { ParsedArgs } from '../parse.ts';

export function requiredValue(args: ParsedArgs, flag: string): string {
    const value = args.values[flag]?.trim();
    if (!value) {
        throw new AgentCliError('INVALID_ARG', `${flag} is required.`);
    }
    return value;
}

export function optionalInteger(
    args: ParsedArgs,
    flag: string,
    options: { minimum: number }
): number | undefined {
    const value = args.values[flag];
    if (value === undefined) {
        return undefined;
    }
    const parsed = Number(value);
    if (!(Number.isSafeInteger(parsed) && parsed >= options.minimum)) {
        throw new AgentCliError(
            'INVALID_ARG',
            `${flag} must be an integer greater than or equal to ${options.minimum}.`
        );
    }
    return parsed;
}

export function assertAgentTarget(target: string): void {
    const channel = /^#[A-Za-z0-9][A-Za-z0-9_-]{0,31}(?::[^:]+)?$/u;
    const dm = /^dm:@[A-Za-z0-9][A-Za-z0-9_-]{0,31}(?::[^:]+)?$/u;
    if (!(channel.test(target) || dm.test(target))) {
        throw new AgentCliError('INVALID_TARGET', `Invalid target "${target}".`, {
            nextAction: 'Use #channel or dm:@peer. Add :<shortId> only for a message thread.',
        });
    }
}

export function valuesFor(args: ParsedArgs, flag: string): string[] {
    return args.valueLists?.[flag] ?? (args.values[flag] ? [args.values[flag]] : []);
}
