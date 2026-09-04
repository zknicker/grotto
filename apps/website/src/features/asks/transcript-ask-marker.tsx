import type { Ask } from '@grotto/api';
import { useTranscriptRenderContextOptional } from '../chats/chat-transcript-render-context.tsx';
import type { TranscriptActor } from '../chats/transcript-contract.ts';
import { MessageAskMarker } from './message-ask-marker.tsx';

/**
 * The Ask marker as a transcript row renders it. Names and faces resolve
 * through the one actor resolver every other row already reads, so an
 * addressee who has since left the Server reads the same here as anywhere.
 */
export function TranscriptAskMarker({ ask }: { ask: Ask }) {
    const resolve = useTranscriptRenderContextOptional()?.resolveActorProfile;
    const addressee = resolve?.({ id: ask.addresseeUserId, kind: 'participant' }) ?? null;
    const answeredBy = ask.answeredBy ? (resolve?.(askAnswerActor(ask.answeredBy)) ?? null) : null;

    return (
        <MessageAskMarker
            addresseeProfile={
                addressee ? { avatarUrl: addressee.avatarUrl, name: addressee.name } : null
            }
            answeredByName={answeredBy?.name ?? null}
            status={ask.status}
        />
    );
}

function askAnswerActor(answeredBy: NonNullable<Ask['answeredBy']>): TranscriptActor {
    return answeredBy.kind === 'agent'
        ? { id: answeredBy.id, kind: 'agent' }
        : { id: answeredBy.id, kind: 'participant' };
}
