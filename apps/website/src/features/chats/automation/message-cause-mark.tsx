import type { MessageCause } from '@grotto/api';
import { CursorHoverCard } from '../../../components/ui/cursor-hover-card.tsx';
import { cn } from '../../../lib/utils.ts';
import { AutomationGlyph, AutomationGlyphBox } from './automation-glyph.tsx';
import { ManageInAutomationsLink } from './automation-manage-link.tsx';
import {
    automationMarkColor,
    messageCauseArchivedNote,
    messageCauseAttributionNote,
    messageCauseHoverRows,
} from './automation-presentation.ts';

/**
 * Why an Agent spoke, in the message header between its name and the time.
 *
 * A fire writes nothing to the transcript, so this mark is the only chat-
 * visible trace of a Trigger or Reminder going off — and it has to say that
 * much in one glyph and a title, at the header line's scale, without reading
 * as a warning. Hovering it previews the automation from the message's own
 * `cause`; the fire's payload and history live in the Thread's context card.
 *
 * Title, glyph, and summary are snapshotted onto the message, so the mark
 * outlives the automation and reads the same after it is archived; only the
 * hover card's live rows go.
 */
export function MessageCauseMark({ cause }: { cause: MessageCause }) {
    return (
        <CursorHoverCard
            className="w-88"
            content={<MessageCauseHoverContent cause={cause} />}
            triggerClassName="min-w-0"
        >
            <span
                className={cn(
                    'inline-flex min-w-0 items-center gap-1 font-semibold text-xs leading-5',
                    automationMarkColor[cause.kind]
                )}
                data-testid="message-cause-mark"
            >
                <AutomationGlyph kind={cause.kind} />
                <span className="truncate">{cause.title}</span>
            </span>
        </CursorHoverCard>
    );
}

export function MessageCauseHoverContent({ cause }: { cause: MessageCause }) {
    const archivedNote = messageCauseArchivedNote(cause);
    const attributionNote = messageCauseAttributionNote(cause);
    const rows = messageCauseHoverRows(cause);

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <header className="flex min-w-0 items-center gap-2.5">
                <AutomationGlyphBox kind={cause.kind} />
                <strong className="min-w-0 truncate font-semibold text-foreground text-sm">
                    {cause.title}
                </strong>
            </header>
            <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                {rows.map((row) => (
                    <div className="contents" key={row.label}>
                        <dt className="text-muted">{row.label}</dt>
                        <dd className="m-0 min-w-0 text-foreground">{row.value}</dd>
                    </div>
                ))}
            </dl>
            {cause.live?.instruction ? (
                <p className="text-muted text-sm leading-snug">{cause.live.instruction}</p>
            ) : null}
            {archivedNote ? (
                <p className="text-muted text-xs leading-snug">{archivedNote}</p>
            ) : null}
            {attributionNote ? (
                <p className="text-muted text-xs leading-snug">{attributionNote}</p>
            ) : null}
            {/* Nothing to manage once the record is gone, so the card ends
                rather than pointing at a tab that no longer lists it. */}
            {cause.live ? (
                <div className="border-separator border-t pt-3">
                    <ManageInAutomationsLink agentId={cause.ownerAgentId} />
                </div>
            ) : null}
        </div>
    );
}
