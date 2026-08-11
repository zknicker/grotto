import type { HostedAgent, HostedChatMessage } from '@tavern/api';
import * as React from 'react';
import type { ActorProfile } from '../../../hooks/actors/use-actor.ts';
import type { TranscriptActor } from '../../chats/chat-transcript-model.ts';
import type { HumanDirectory } from '../human-identity.ts';

type IdentifiedAuthor = Extract<HostedChatMessage['author'], { kind: 'agent' | 'human' }>;
type AuthorProfile = NonNullable<IdentifiedAuthor['profile']>;
interface ProfileSource {
    id: string;
    kind: 'agent' | 'human';
    profile: AuthorProfile;
}

/**
 * Names and faces for the actors a transcript renders. The returned resolver
 * keeps its identity across ordinary message refetches so the transcript's
 * render context — and therefore every memoized row — stays stable.
 */
export function useResolveActorProfile({
    agentsById,
    humans,
    messages,
}: {
    agentsById: ReadonlyMap<string, HostedAgent>;
    humans: HumanDirectory;
    messages: readonly HostedChatMessage[];
}) {
    const historicalProfiles = useHistoricalActorProfiles(messages, humans);

    return React.useCallback(
        (actor: TranscriptActor): ActorProfile | null => {
            if (!actor) {
                return null;
            }

            if (actor.kind === 'agent') {
                const agent = agentsById.get(actor.id);

                return agent
                    ? {
                          avatarUrl: agent.avatarUrl,
                          bio: agent.description,
                          deleted: false,
                          id: agent.id,
                          isSelf: false,
                          kind: 'agent',
                          name: agent.displayName,
                      }
                    : (historicalProfiles.get(`agent:${actor.id}`) ?? null);
            }

            const member = humans.member(actor.id);
            const historical = historicalProfiles.get(`human:${actor.id}`);

            if (!member && historical) {
                return historical;
            }

            return {
                avatarUrl: humans.avatarUrl(actor.id),
                bio: member?.description ?? null,
                deleted: false,
                id: actor.id,
                isSelf: humans.isSelf(actor.id),
                kind: actor.kind,
                name: humans.name(actor.id),
            };
        },
        [agentsById, historicalProfiles, humans]
    );
}

/**
 * An author who has since left the Server is only nameable from the messages
 * they wrote. Structural sharing keeps each message's author profile object
 * identical across refetches, so this map changes identity only when the set
 * of remembered authors actually changes — not on every new message.
 */
function useHistoricalActorProfiles(
    messages: readonly HostedChatMessage[],
    humans: HumanDirectory
) {
    const cacheRef = React.useRef<{
        humans: HumanDirectory | null;
        profiles: ReadonlyMap<string, ActorProfile>;
        sources: ReadonlyMap<string, ProfileSource>;
    }>({ humans: null, profiles: new Map(), sources: new Map() });

    return React.useMemo(() => {
        const sources = new Map<string, ProfileSource>();

        for (const message of messages) {
            const author = message.author;

            if (author.kind === 'system' || !author.profile) {
                continue;
            }

            const id = author.kind === 'agent' ? author.agentId : author.userId;

            sources.set(`${author.kind}:${id}`, { id, kind: author.kind, profile: author.profile });
        }

        const cache = cacheRef.current;

        if (cache.humans === humans && areSameProfileSources(cache.sources, sources)) {
            return cache.profiles;
        }

        const profiles = new Map<string, ActorProfile>();

        for (const [key, source] of sources) {
            profiles.set(key, {
                avatarUrl: source.profile.avatarUrl,
                bio: source.profile.description,
                deleted: source.profile.deleted,
                id: source.id,
                isSelf: source.kind === 'human' && humans.isSelf(source.id),
                kind: source.kind === 'agent' ? 'agent' : 'participant',
                name: source.profile.displayName,
            });
        }

        cacheRef.current = { humans, profiles, sources };

        return profiles;
    }, [humans, messages]);
}

function areSameProfileSources(
    previous: ReadonlyMap<string, ProfileSource>,
    next: ReadonlyMap<string, ProfileSource>
) {
    if (previous.size !== next.size) {
        return false;
    }

    for (const [key, source] of next) {
        if (previous.get(key)?.profile !== source.profile) {
            return false;
        }
    }

    return true;
}
