import type { AutomationFireContext, MessageCause } from '@grotto/api';
import { formatRelativeTime, formatTimestamp } from '../../../lib/format.ts';
import { formatTriggerPayloadSize } from '../../members/agent-profile/agent-trigger-model.ts';

/**
 * How a caused message presents its provenance: the header mark, its hover
 * card, and the Thread context card all read from here, so a Trigger and a
 * Reminder are told apart in one place rather than at three call sites.
 */

export type AutomationKind = MessageCause['kind'];

/** The mark's ink. One token per automation, resolved through Tailwind. */
export const automationMarkColor = {
    reminder: 'text-reminder-mark',
    trigger: 'text-trigger-mark',
} as const satisfies Record<AutomationKind, string>;

/**
 * A status is a resting state someone chose, not a failure, so only `armed`
 * and `scheduled` carry colour — the inert states stay neutral rather than
 * borrowing `danger` and reading as breakage.
 */
export function automationStatusChip(status: MessageCause['status']): {
    color: 'accent' | 'default' | 'success';
    label: string;
} {
    switch (status) {
        case 'armed':
            return { color: 'success', label: 'Armed' };
        case 'scheduled':
            return { color: 'accent', label: 'Scheduled' };
        case 'fired':
            return { color: 'default', label: 'Fired' };
        case 'canceled':
            return { color: 'default', label: 'Canceled' };
        default:
            return { color: 'default', label: 'Disabled' };
    }
}

export interface AutomationHoverRow {
    label: string;
    value: string;
}

/**
 * The hover card's labelled rows, built from the message alone — the cause
 * rides every message the Server hands a client, so previewing an automation
 * costs no second read.
 */
export function messageCauseHoverRows(cause: MessageCause, now = Date.now()): AutomationHoverRow[] {
    const lastFired = {
        label: 'Last fired',
        value: cause.lastFiredAt ? formatRelativeTime(cause.lastFiredAt, now) : 'Never',
    };

    if (cause.kind === 'reminder') {
        return [
            { label: 'Cadence', value: cause.summary },
            { label: 'Status', value: automationStatusChip(cause.status).label },
            lastFired,
        ];
    }

    return [
        { label: 'Kind', value: cause.summary },
        { label: 'Status', value: automationStatusChip(cause.status).label },
        lastFired,
        { label: 'Fires', value: String(cause.fireCount) },
    ];
}

/**
 * Says so when the link between the message and the fire is the Server's own
 * conclusion rather than the Agent's claim: the fire was the only thing that
 * run was offered and the message landed in its anchor Chat. An explicit
 * `--cause` needs no note — an unqualified mark already means the Agent said
 * so — so only the inferred case carries one.
 */
export function messageCauseAttributionNote(cause: MessageCause): string | null {
    return cause.attribution === 'inferred'
        ? 'Attributed by Grotto — the Agent did not name this fire.'
        : null;
}

/**
 * One fact of the context card's meta line. `value` is the part that carries
 * the information and is inked in the foreground; the muted words around it
 * only say what it means.
 */
export interface AutomationMetaPart {
    prefix?: string;
    suffix?: string;
    value: string;
}

/**
 * `Webhook · Fired 4m ago · fire 12 of 12` for a Trigger,
 * `Every Monday at 09:00 · Next Mon 9:00 AM` for a Reminder.
 */
export function fireContextMetaParts(
    context: AutomationFireContext,
    now = Date.now()
): AutomationMetaPart[] {
    if (context.cause.kind === 'reminder') {
        const parts: AutomationMetaPart[] = [{ value: context.repeat ?? context.cause.summary }];
        if (context.nextFireAt) {
            parts.push({ prefix: 'Next', value: formatUpcomingTime(context.nextFireAt) });
        }
        return parts;
    }

    return [
        { value: context.cause.summary },
        { prefix: 'Fired', value: formatRelativeTime(context.firedAt, now) },
        {
            prefix: 'fire',
            suffix: `of ${context.fireTotal}`,
            value: String(context.fireOrdinal),
        },
    ];
}

/**
 * The payload disclosure's summary. Bytes are the sender's, not the excerpt's,
 * so a truncated excerpt still reports what actually arrived.
 */
export function fireContextPayloadLabel(context: AutomationFireContext): string | null {
    if (context.payload === null || context.payloadBytes === null) {
        return null;
    }

    const parts = ['Payload', formatTriggerPayloadSize(context.payloadBytes)];
    if (context.contentType) {
        parts.push(context.contentType);
    }
    return parts.join(' · ');
}

/**
 * Shiki's id for the excerpt. A sender's content type is a full media type
 * with parameters, so match on what it starts with rather than on equality;
 * anything unrecognized renders as plain text rather than mis-highlighted.
 */
export function fireContextPayloadLanguage(contentType: string | null): string {
    const media = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    if (media.endsWith('/json') || media.endsWith('+json')) {
        return 'json';
    }
    if (media === 'text/html' || media.endsWith('/xml') || media.endsWith('+xml')) {
        return 'xml';
    }
    return 'plaintext';
}

/** The message a Reminder was set from, quoted the way the hover card quotes it. */
export function fireContextAnchorNote(context: AutomationFireContext): string | null {
    return context.anchorExcerpt ? `Anchored on: “${context.anchorExcerpt}”` : null;
}

/**
 * A time that has not happened yet reads by weekday, not by date: "Mon 9:00 AM"
 * is what someone would say about the next fire, where "Sep 7, 9:00 AM" makes
 * them count days. Past a week the weekday stops being enough and the calendar
 * date takes over.
 */
export function formatUpcomingTime(value: string, now = Date.now()): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    if (date.getTime() - now > sevenDaysMs) {
        return formatTimestamp(value);
    }
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        weekday: 'short',
    }).format(date);
}

const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
