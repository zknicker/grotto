import { Spinner } from '@heroui/react';
import * as React from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ActivationShell, ActivationStep } from '../../components/activation/activation-shell.tsx';
import { useServer } from '../../hooks/servers/use-server.ts';
import { CoveComputerStep } from './cove-computer-step.tsx';
import { CoveMeetStep } from './cove-meet-step.tsx';
import { getCoveOnboardingView, resolveCoveAppHandoff } from './cove-onboarding-model.ts';
import { SetupProgressMarker } from './cove-step-parts.tsx';

/** Mandatory fresh-Server gate, structurally outside the general Server shell. */
export function CoveOnboardingRoute() {
    const { slug = '' } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const wasGated = React.useRef(false);
    const server = useServer(slug);

    if (server.error && !server.data) {
        return (
            <ActivationShell>
                <ActivationStep description={server.error.message} title="Server Unavailable" />
            </ActivationShell>
        );
    }
    if (!server.data) {
        if (wasGated.current) {
            return (
                <ActivationShell>
                    <Spinner aria-label="Loading this Server" size="sm" />
                </ActivationShell>
            );
        }
        return null;
    }

    const canManageOnboarding = server.data.role === 'owner';
    if (!canManageOnboarding) {
        return <Outlet />;
    }

    const view = getCoveOnboardingView(server.data.onboarding);
    if (view === 'app') {
        const serverRoot = `/s/${server.data.slug}`;
        const target = `/s/${server.data.slug}/chats/${server.data.onboarding.channelId}`;
        const handoff = resolveCoveAppHandoff({
            onboardingChatPath: target,
            pathname: location.pathname,
            pending: wasGated.current,
            serverRootPath: serverRoot,
        });
        wasGated.current = handoff.pending;
        if (handoff.redirect) {
            return <Navigate replace to={handoff.redirect} />;
        }
        return <Outlet />;
    }
    wasGated.current = true;

    const switchServer = () => navigate('/s');
    const meetingCove = ['meet-cove', 'applying-cove', 'apply-failed'].includes(view);
    return (
        <ActivationShell
            // Once Cove leads the screen, the brand mark would be a second star.
            mark={meetingCove ? null : undefined}
            progress={
                <SetupProgressMarker stage={meetingCove ? 'meet-cove' : 'connect-computer'} />
            }
        >
            {view === 'meet-cove' || view === 'applying-cove' || view === 'apply-failed' ? (
                <CoveMeetStep
                    onboarding={server.data.onboarding}
                    onSwitchServer={switchServer}
                    serverId={server.data.id}
                    view={view}
                />
            ) : (
                <CoveComputerStep
                    failure={server.data.onboarding.failure}
                    onSwitchServer={switchServer}
                    serverSlug={server.data.slug}
                    view={view}
                />
            )}
        </ActivationShell>
    );
}
