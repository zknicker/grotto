import * as React from 'react';
import type { ProjectedChatMessageRow } from './chat-message-model.ts';

export type LocalReactionsByMessage = Record<
    string,
    { actors: { handle: null | string; id: string }[]; emoji: string }[]
>;

const localReactionViewer = { handle: 'you', id: 'usr_grotto' } as const;

/**
 * App-local reactions until the Server reaction API lands: toggling only
 * updates this in-memory map, so the reaction UI is fully exercisable today
 * and swaps to the server mutation later without UI changes.
 */
export function useLocalChatReactions() {
    const [reactions, setReactions] = React.useState<LocalReactionsByMessage>({});
    const onToggleReaction = React.useCallback(
        (input: { emoji: string; messageId: string; remove: boolean }) =>
            setReactions((previous) => toggleLocalReaction(previous, input)),
        []
    );

    return { onToggleReaction, reactions };
}

/** Leaves untouched rows at their existing identity so their memo still holds. */
export function applyLocalReactions(
    rows: ProjectedChatMessageRow[],
    reactions: LocalReactionsByMessage
): ProjectedChatMessageRow[] {
    if (Object.keys(reactions).length === 0) {
        return rows;
    }

    return rows.map((row) =>
        row.kind === 'message' && reactions[row.id]?.length
            ? { ...row, message: { ...row.message, reactions: reactions[row.id] } }
            : row
    );
}

export function toggleLocalReaction(
    previous: LocalReactionsByMessage,
    input: { emoji: string; messageId: string; remove: boolean }
): LocalReactionsByMessage {
    const current = previous[input.messageId] ?? [];
    const next = input.remove
        ? current
              .map((reaction) =>
                  reaction.emoji === input.emoji
                      ? {
                            ...reaction,
                            actors: reaction.actors.filter(
                                ({ id }) => id !== localReactionViewer.id
                            ),
                        }
                      : reaction
              )
              .filter((reaction) => reaction.actors.length > 0)
        : current.some((reaction) => reaction.emoji === input.emoji)
          ? current.map((reaction) =>
                reaction.emoji === input.emoji &&
                !reaction.actors.some(({ id }) => id === localReactionViewer.id)
                    ? { ...reaction, actors: [...reaction.actors, localReactionViewer] }
                    : reaction
            )
          : [...current, { actors: [localReactionViewer], emoji: input.emoji }];

    return { ...previous, [input.messageId]: next };
}
