import { DrawerPanel } from '../../../components/ui/drawer.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import { SessionLinkButton } from '../session-link-button.tsx';
import { buildToolDrawerCall, type ToolDrawerDetails } from './tool-drawer-call.ts';
import { resolveToolDrawerBody } from './tool-drawer-registry.tsx';

interface ToolDrawerBodyProps {
    details: ToolDrawerDetails | null;
    isPending: boolean;
    queryError: boolean;
}

export function ToolDrawerBody({ details, isPending, queryError }: ToolDrawerBodyProps) {
    const BodyRenderer = details ? resolveToolDrawerBody(details.toolCall.name) : null;

    return (
        <DrawerPanel className="space-y-5">
            {(details?.actions ?? []).map((action) => (
                <SessionLinkButton
                    key={`${action.kind}:${action.sessionKey}:${action.label}`}
                    label={action.label}
                    sessionKey={action.sessionKey}
                    subtitle={action.subtitle}
                    title={action.title}
                    tone={action.tone}
                />
            ))}
            {isPending ? (
                <div className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-legacy-muted px-3.5 py-3">
                    <StatusDot className="animate-pulse" status="muted" />
                    <p className="text-muted-foreground text-sm">Loading tool details...</p>
                </div>
            ) : null}
            {!isPending && queryError ? (
                <div className="rounded-lg border border-[color:var(--error-border)] bg-[var(--error-bg)] px-3.5 py-3">
                    <p className="text-error-foreground text-sm">Tool details not available.</p>
                </div>
            ) : null}
            {details && BodyRenderer ? <BodyRenderer call={buildToolDrawerCall(details)} /> : null}
        </DrawerPanel>
    );
}
