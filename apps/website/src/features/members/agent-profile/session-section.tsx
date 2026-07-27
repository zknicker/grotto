import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { useAgentSessionReset } from '../../../hooks/agents/use-agent-session.ts';
import { withSaveErrorToast } from '../../../lib/saving-toast.ts';
import type { AgentListOutput } from '../../../lib/trpc.tsx';

// Manual reset contract (specs/sessions.md): agent-scoped, human-initiated,
// and owned by the agent profile.
export function AgentSessionSection({ agent }: { agent: AgentListOutput['agents'][number] }) {
    const resetSession = useAgentSessionReset();
    const [isFullResetOpen, setIsFullResetOpen] = useState(false);

    return (
        <SettingsSection title="Session">
            <SettingsGroup>
                <SettingsRow
                    description="Start the agent's next turn with fresh context. Workspace and memory persist."
                    title="Start fresh session"
                    trailingWidth="intrinsic"
                >
                    <Button
                        loading={resetSession.isPending}
                        onClick={() =>
                            withSaveErrorToast(() =>
                                resetSession.mutateAsync({ agentId: agent.id, kind: 'session' })
                            ).catch(() => undefined)
                        }
                        variant="outline"
                    >
                        Start fresh session
                    </Button>
                </SettingsRow>

                <Separator />

                <SettingsRow
                    description="Fresh context that also wipes the workspace, MEMORY.md, and skills back to factory. Identity, history, and configuration are kept."
                    title="Full reset"
                    trailingWidth="intrinsic"
                >
                    <Button onClick={() => setIsFullResetOpen(true)} variant="destructive-outline">
                        Full reset
                    </Button>
                </SettingsRow>
            </SettingsGroup>

            <FullResetDialog
                agent={agent}
                onOpenChange={setIsFullResetOpen}
                open={isFullResetOpen}
            />
        </SettingsSection>
    );
}

function FullResetDialog({
    agent,
    onOpenChange,
    open,
}: {
    agent: AgentListOutput['agents'][number];
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    const resetSession = useAgentSessionReset();

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                onOpenChange(nextOpen);

                if (nextOpen) {
                    resetSession.reset();
                }
            }}
            open={open}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Full reset?</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 px-6 pb-6">
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Fully reset this agent? This starts a fresh session and wipes the
                        agent&apos;s workspace, MEMORY.md, and skills back to factory defaults.
                        These cannot be recovered. Identity, chat history, model configuration, and
                        connections are kept.
                    </p>
                    {resetSession.error ? (
                        <Alert variant="error">
                            <Icon icon={AlertCircleIcon} />
                            <AlertDescription>{resetSession.error.message}</AlertDescription>
                        </Alert>
                    ) : null}
                    <div className="flex justify-end gap-2">
                        <Button
                            disabled={resetSession.isPending}
                            onClick={() => onOpenChange(false)}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            Cancel
                        </Button>
                        <Button
                            loading={resetSession.isPending}
                            onClick={async () => {
                                await resetSession.mutateAsync({
                                    agentId: agent.id,
                                    kind: 'full',
                                });
                                onOpenChange(false);
                            }}
                            size="sm"
                            type="button"
                            variant="destructive"
                        >
                            Full reset
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
