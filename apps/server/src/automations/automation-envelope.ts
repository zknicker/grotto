/**
 * The one command that answers an automation fire. A Trigger or Reminder fire
 * writes nothing to the transcript, so the Agent's own message is the only
 * chat-visible trace of it; sending with `--cause` is what records the
 * message→fire provenance the transcript mark and thread context card read.
 * Every fire envelope ends with this line.
 */
export function automationReplyLine(fireId: string): string {
    return `reply with: grotto message send --cause ${fireId}`;
}
