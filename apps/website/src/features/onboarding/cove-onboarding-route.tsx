import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useServer } from '../../hooks/servers/use-server.ts';
import { CoveComputerStep } from './cove-computer-step.tsx';
import { CoveMeetStep } from './cove-meet-step.tsx';
import { getCoveOnboardingView } from './cove-onboarding-model.ts';
import { SetupProgressMarker } from './cove-onboarding-prototype/cove-prototype-review.tsx';
import './cove-onboarding-prototype/cove-prototype.css';

/** Mandatory fresh-Server gate, structurally outside the general Server shell. */
export function CoveOnboardingRoute() {
    const { slug = '' } = useParams();
    const navigate = useNavigate();
    const server = useServer(slug);

    if (server.error && !server.data) {
        return (
            <main className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
                <h1 className="font-semibold text-foreground text-lg">Server unavailable</h1>
                <p className="max-w-sm text-muted text-sm">{server.error.message}</p>
            </main>
        );
    }
    if (!server.data) {
        return null;
    }

    const view = getCoveOnboardingView(server.data.onboarding);
    if (view === 'app') {
        return <Outlet />;
    }

    const switchServer = () => navigate('/s');
    return (
        <div className="cove-prototype min-h-dvh bg-background text-foreground">
            <header className="cove-frame-header">
                <SetupProgressMarker
                    state={view === 'meet-cove' ? 'meet-cove' : 'connect-computer'}
                />
            </header>
            <main className="cove-frame-main">
                {view === 'meet-cove' ? (
                    <CoveMeetStep
                        onboarding={server.data.onboarding}
                        onSwitchServer={switchServer}
                        serverId={server.data.id}
                    />
                ) : (
                    <CoveComputerStep
                        failure={server.data.onboarding.failure}
                        onSwitchServer={switchServer}
                        serverSlug={server.data.slug}
                        view={view}
                    />
                )}
            </main>
        </div>
    );
}
