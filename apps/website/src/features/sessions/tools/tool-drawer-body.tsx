import { Alert, Spinner } from '@heroui/react';
import { SessionLinkButton } from '../session-link-button.tsx';
import { buildToolDrawerCall, type ToolDrawerDetails } from './tool-drawer-call.ts';
import { resolveToolDrawerBody } from './tool-drawer-registry.tsx';

interface ToolDrawerBodyProps {
    details: ToolDrawerDetails | null;
    isPending: boolean;
    queryError: boolean;
}

// Body content only: the drawer shell owns Drawer.Body so this stays
// renderable on its own in tests.
export function ToolDrawerBody({ details, isPending, queryError }: ToolDrawerBodyProps) {
    const BodyRenderer = details ? resolveToolDrawerBody(details.toolCall.name) : null;

    return (
        <div className="flex min-w-0 flex-col gap-5">
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
                <div className="flex items-center gap-2.5 rounded-lg border border-separator bg-surface-secondary px-3.5 py-3">
                    <Spinner size="sm" />
                    <p className="text-muted text-sm">Loading tool details...</p>
                </div>
            ) : null}
            {!isPending && queryError ? (
                <Alert status="danger">
                    <Alert.Content>
                        <Alert.Description>Tool details not available.</Alert.Description>
                    </Alert.Content>
                </Alert>
            ) : null}
            {details && BodyRenderer ? <BodyRenderer call={buildToolDrawerCall(details)} /> : null}
        </div>
    );
}
