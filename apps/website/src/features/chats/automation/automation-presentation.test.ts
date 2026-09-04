import { expect, test } from 'bun:test';
import type { AutomationFireContext, MessageCause } from '@grotto/api';
import {
    automationStatusChip,
    fireContextAnchorNote,
    fireContextMetaParts,
    fireContextPayloadLabel,
    fireContextPayloadLanguage,
    formatUpcomingTime,
    messageCauseAttributionNote,
    messageCauseHoverRows,
} from './automation-presentation.ts';

const now = Date.parse('2026-09-03T12:00:00.000Z');

test('only a live automation status carries colour', () => {
    expect(automationStatusChip('armed')).toEqual({ color: 'success', label: 'Armed' });
    expect(automationStatusChip('scheduled')).toEqual({ color: 'accent', label: 'Scheduled' });
    expect(automationStatusChip('disabled')).toEqual({ color: 'default', label: 'Disabled' });
    expect(automationStatusChip('canceled')).toEqual({ color: 'default', label: 'Canceled' });
    expect(automationStatusChip('fired')).toEqual({ color: 'default', label: 'Fired' });
});

test('a Trigger previews its kind, status, last fire, and fire count', () => {
    expect(messageCauseHoverRows(triggerCause(), now)).toEqual([
        { label: 'Kind', value: 'Webhook' },
        { label: 'Status', value: 'Armed' },
        { label: 'Last fired', value: '4m ago' },
        { label: 'Fires', value: '12' },
    ]);
});

test('a Reminder previews its cadence instead of a fire count', () => {
    const rows = messageCauseHoverRows(reminderCause(), now);

    expect(rows[0]).toEqual({ label: 'Cadence', value: 'Every Monday at 09:00' });
    expect(rows.map((row) => row.label)).toEqual(['Cadence', 'Status', 'Last fired']);
});

test('an automation that has never fired says so rather than showing a date', () => {
    expect(messageCauseHoverRows({ ...triggerCause(), lastFiredAt: null }, now)).toContainEqual({
        label: 'Last fired',
        value: 'Never',
    });
});

test('a Trigger fire states its kind, when it fired, and its place in the history', () => {
    expect(fireContextMetaParts(triggerContext(), now)).toEqual([
        { value: 'Webhook' },
        { prefix: 'Fired', value: '4m ago' },
        { prefix: 'fire', suffix: 'of 12', value: '12' },
    ]);
});

test('a Reminder fire states its cadence and its next fire', () => {
    const parts = fireContextMetaParts(reminderContext(), now);

    expect(parts[0]).toEqual({ value: 'Every Monday at 09:00' });
    expect(parts[1]?.prefix).toBe('Next');
    expect(parts[1]?.value).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}:\d{2}\s(AM|PM)$/u);
});

test('a canceled Reminder with no next fire states only its cadence', () => {
    expect(fireContextMetaParts({ ...reminderContext(), nextFireAt: null }, now)).toHaveLength(1);
});

test('the payload disclosure names the bytes that arrived and their content type', () => {
    expect(fireContextPayloadLabel(triggerContext())).toBe('Payload · 52 bytes · application/json');
    expect(fireContextPayloadLabel({ ...triggerContext(), contentType: null })).toBe(
        'Payload · 52 bytes'
    );
    expect(
        fireContextPayloadLabel({ ...triggerContext(), payload: null, payloadBytes: null })
    ).toBeNull();
});

test('payload highlighting reads the media type, not the whole content-type header', () => {
    expect(fireContextPayloadLanguage('application/json; charset=utf-8')).toBe('json');
    expect(fireContextPayloadLanguage('application/vnd.github+json')).toBe('json');
    expect(fireContextPayloadLanguage('application/xml')).toBe('xml');
    expect(fireContextPayloadLanguage('application/x-www-form-urlencoded')).toBe('plaintext');
    expect(fireContextPayloadLanguage(null)).toBe('plaintext');
});

test('a Reminder quotes the message it was set from, and a Trigger has none', () => {
    expect(fireContextAnchorNote(reminderContext())).toBe(
        'Anchored on: “Remind me to write the weekly self-review”'
    );
    expect(fireContextAnchorNote(triggerContext())).toBeNull();
});

test('a fire within the week reads by weekday and falls back to a date past it', () => {
    expect(formatUpcomingTime('2026-09-07T13:00:00.000Z', now)).toMatch(
        /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) /u
    );
    expect(formatUpcomingTime('2026-10-07T13:00:00.000Z', now)).toMatch(/^Oct \d+/u);
});

test('only an inferred cause explains itself', () => {
    expect(messageCauseAttributionNote(triggerCause())).toBeNull();
    expect(messageCauseAttributionNote({ ...triggerCause(), attribution: 'inferred' })).toContain(
        'Attributed by Grotto'
    );
});

function triggerCause(): MessageCause {
    return {
        attribution: 'explicit',
        automationId: 'trg_deploy',
        fireCount: 12,
        fireId: 'trf_12',
        instruction: 'Summarize the deploy in this DM; flag failures.',
        kind: 'trigger',
        lastFiredAt: '2026-09-03T11:56:00.000Z',
        ownerAgentId: 'agt_blippy',
        status: 'armed',
        summary: 'Webhook',
        title: 'Deploy finished',
    };
}

function reminderCause(): MessageCause {
    return {
        attribution: 'explicit',
        automationId: 'rem_review',
        fireCount: 6,
        fireId: 'rmf_6',
        instruction: null,
        kind: 'reminder',
        lastFiredAt: '2026-08-27T13:00:00.000Z',
        ownerAgentId: 'agt_blippy',
        status: 'scheduled',
        summary: 'Every Monday at 09:00',
        title: 'Weekly self-review',
    };
}

function triggerContext(): AutomationFireContext {
    return {
        anchorChatId: 'cht_dm',
        anchorExcerpt: null,
        anchorMessageId: null,
        cause: triggerCause(),
        contentType: 'application/json',
        firedAt: '2026-09-03T11:56:00.000Z',
        fireOrdinal: 12,
        fireTotal: 12,
        nextFireAt: null,
        payload: '{"repo":"grotto"}',
        payloadBytes: 52,
        payloadTruncated: false,
        repeat: null,
    };
}

function reminderContext(): AutomationFireContext {
    return {
        anchorChatId: 'cht_dm',
        anchorExcerpt: 'Remind me to write the weekly self-review',
        anchorMessageId: 'msg_anchor',
        cause: reminderCause(),
        contentType: null,
        firedAt: '2026-08-27T13:00:00.000Z',
        fireOrdinal: 6,
        fireTotal: 6,
        nextFireAt: '2026-09-07T13:00:00.000Z',
        payload: null,
        payloadBytes: null,
        payloadTruncated: false,
        repeat: 'Every Monday at 09:00',
    };
}
