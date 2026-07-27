import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/primitives/button.tsx';
import {
    useAcceptInvitation,
    useInvitationPreview,
} from '../../hooks/servers/use-accept-invitation.ts';

/**
 * Where an invited human lands. The Server decides whether their signed-in
 * Clerk identity carries the verified address this invitation is bound to; the
 * page only reports that answer. It never learns whose address it is.
 */
export function AcceptInvitationPage() {
    const { token = '' } = useParams();
    const preview = useInvitationPreview(token);
    const accept = useAcceptInvitation();

    if (preview.error) {
        return (
            <InvitationMessage
                detail="This invitation may have been revoked, already used, or expired. Ask whoever invited you for a new one."
                title="Invitation unavailable"
            />
        );
    }

    if (!preview.data) {
        return null;
    }

    if (!preview.data.emailMatches) {
        return (
            <InvitationMessage
                detail={`This invitation to ${preview.data.serverDisplayName} is for a different verified email address. Sign in with the address it was sent to, then open this link again.`}
                title="Wrong account"
            />
        );
    }

    return (
        <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-24 text-center">
            <div className="flex flex-col gap-2">
                <h1 className="font-display text-2xl text-foreground">
                    Join {preview.data.serverDisplayName}
                </h1>
                <p className="text-muted-foreground text-sm">
                    You will join /{preview.data.serverSlug} as a member of #all.
                </p>
            </div>
            <Button disabled={accept.isPending} onClick={() => accept.mutate({ token })} size="lg">
                Accept invitation
            </Button>
            {accept.error ? (
                <p className="text-destructive text-sm">{accept.error.message}</p>
            ) : null}
        </main>
    );
}

function InvitationMessage({ detail, title }: { detail: string; title: string }) {
    return (
        <main className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
            <h1 className="font-semibold text-foreground text-lg">{title}</h1>
            <p className="max-w-sm text-muted-foreground text-sm">{detail}</p>
        </main>
    );
}
