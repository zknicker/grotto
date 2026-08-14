import type { AgentAvailability } from '@tavern/api';
import { useMemo } from 'react';
import type { HistoryActorOutput } from '../../lib/trpc.tsx';
import { useAgentList } from '../agents/use-agent-list.ts';
import { useCurrentUser } from '../identity/use-current-user.ts';
import { useParticipantList } from '../participants/use-participant-list.ts';
import { useUserProfilePreference } from '../shell/use-user-profile-preference.ts';

interface ActorProfileBase {
    avatarUrl: string | null;
    bio: string | null;
    id: string;
    isSelf: boolean;
    name: string;
}

export type ActorProfile =
    | (ActorProfileBase & {
          deleted: false;
          kind: 'agent';
          availability: { kind: 'live'; value: AgentAvailability };
      })
    | (ActorProfileBase & {
          deleted: boolean;
          kind: 'agent';
          availability: { kind: 'none' };
      })
    | (ActorProfileBase & {
          deleted: boolean;
          kind: Exclude<HistoryActorOutput['kind'], 'agent'>;
          availability: { kind: 'none' };
      });

const selfProfileActorId = 'profile:self';
// Keyless chat uses this synthetic participant. Owner-scoped session evidence
// keeps profile:self; both remain self alongside the signed-in Tavern user id.
export const localHumanParticipantId = 'usr_tavern';

export function isLocalOwnerActor(
    actor: HistoryActorOutput | null,
    currentUserId: string | null
): boolean {
    if (!actor) {
        return false;
    }

    return (
        (actor.kind === 'profile' && actor.id === selfProfileActorId) ||
        (actor.kind === 'participant' &&
            (actor.id === localHumanParticipantId || actor.id === currentUserId))
    );
}

export function useActorProfile(actor: HistoryActorOutput | null) {
    const agentsQuery = useAgentList();
    const participantsQuery = useParticipantList();
    const userProfile = useUserProfilePreference();
    const { tavernUserId } = useCurrentUser();

    return useMemo(() => {
        if (!actor) {
            return null;
        }

        if (actor.kind === 'agent') {
            const agent = agentsQuery.data?.agents.find((entry) => entry.id === actor.id);

            return agent
                ? ({
                      avatarUrl: agent.avatarUrl,
                      bio: agent.bio ?? null,
                      deleted: false,
                      id: agent.id,
                      isSelf: false,
                      kind: 'agent',
                      name: agent.name,
                      availability: { kind: 'none' },
                  } satisfies ActorProfile)
                : null;
        }

        // The current user and legacy owner-scoped actors use the locally
        // configured name and avatar.
        if (isLocalOwnerActor(actor, tavernUserId)) {
            return {
                avatarUrl: userProfile.avatarUrl,
                bio: null,
                deleted: false,
                id: actor.id,
                isSelf: true,
                kind: actor.kind,
                name: userProfile.displayName ?? 'You',
                availability: { kind: 'none' },
            } satisfies ActorProfile;
        }

        if (actor.kind === 'profile') {
            return null;
        }

        const participant = participantsQuery.data?.participants.find(
            (entry) => entry.id === actor.id
        );

        return participant
            ? ({
                  avatarUrl: null,
                  bio: null,
                  deleted: false,
                  id: participant.id,
                  isSelf: false,
                  kind: 'participant',
                  name: participant.name,
                  availability: { kind: 'none' },
              } satisfies ActorProfile)
            : null;
    }, [
        actor,
        agentsQuery.data?.agents,
        participantsQuery.data?.participants,
        tavernUserId,
        userProfile.avatarUrl,
        userProfile.displayName,
    ]);
}
