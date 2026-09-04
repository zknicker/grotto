import { automationReplyLine } from '../automations/automation-envelope.ts';

/** Largest script output one wake envelope carries; launch caps an item at 32 KiB. */
export const reminderScriptOutputMaxChars = 30_000;

export interface ReminderScriptOutcome {
    exitCode: number;
    output: string;
    timedOut: boolean;
}

export interface ReminderEnvelopeInput {
    fireId: string;
    /** The next scheduled fire for a repeating Reminder, else null. */
    nextFireAt: Date | null;
    script?: ReminderScriptOutcome | null;
    title: string;
}

/**
 * The body the owning Agent pulls off the delivery ledger when a Reminder
 * fires. A fire writes nothing to the transcript, so this envelope is the whole
 * wake: the heading, the exact fire id, the next occurrence when the Reminder
 * repeats, the script's outcome when it has one, and the command that answers
 * this fire with its provenance attached.
 *
 * Script output is indented for the same reason a Trigger payload is: an
 * indented line can never start with `[target=`, so a command's output cannot
 * forge an envelope header and impersonate a Grotto human, agent, or system.
 */
export function reminderEnvelope(input: ReminderEnvelopeInput): string {
    return [
        reminderHeading(input.title),
        `fire=${input.fireId}`,
        ...(input.nextFireAt ? [`(next: ${input.nextFireAt.toISOString()})`] : []),
        ...(input.script ? scriptLines(input.script) : []),
        automationReplyLine(input.fireId),
    ].join('\n');
}

/** The envelope's first line. Nothing writes this into a Chat any more. */
export function reminderHeading(title: string): string {
    return `🔔 Reminder: ${title}`;
}

/**
 * A script run the Agent should hear about, or null when it succeeded with
 * nothing to say. Silence on empty success is the whole point of a watchdog
 * script: it wakes its Agent only when it has something to report.
 */
export function reminderScriptLines(script: ReminderScriptOutcome): string[] | null {
    const lines = scriptLines(script);
    return lines.length > 0 ? lines : null;
}

function scriptLines(script: ReminderScriptOutcome): string[] {
    const output = script.output.trim().slice(0, reminderScriptOutputMaxChars);
    if (!(output || script.timedOut) && script.exitCode === 0) {
        return [];
    }
    const heading = script.timedOut
        ? '🔔 Reminder script timed out.'
        : script.exitCode === 0
          ? '🔔 Reminder script output:'
          : `🔔 Reminder script exited ${script.exitCode}.`;
    return [heading, ...indent(output)];
}

function indent(output: string): string[] {
    if (output.length === 0) {
        return [];
    }
    return output.split(/\r\n|\r|\n/u).map((line) => `  ${line}`);
}
