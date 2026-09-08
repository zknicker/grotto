/** Gives headless evaluation traffic the same Server identity the App establishes. */
export function syncEvalHumanIdentity(trpc, serverId) {
    return trpc('member.syncIdentity', {
        email: 'evaluations@grotto.invalid',
        name: 'Grotto Evaluator',
        serverId,
    });
}
