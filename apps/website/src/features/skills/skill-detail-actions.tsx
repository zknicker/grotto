import {
    AddCircleIcon,
    ArrowReloadHorizontalIcon,
    Delete02Icon,
    MoreHorizontalIcon,
    RefreshIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '../../components/ui/menu.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { toastManager } from '../../components/ui/toast.tsx';
import { useSkillHubInstall } from '../../hooks/skills/use-skill-hub-install.ts';
import { useSkillHubUninstall } from '../../hooks/skills/use-skill-hub-uninstall.ts';
import { useSkillReset } from '../../hooks/skills/use-skill-reset.ts';
import {
    ResetConfirmDialog,
    showSkillFailureToast,
    UpdateConflictDialog,
} from './skill-content-dialogs.tsx';
import { SkillEnableSwitch } from './skill-enable-switch.tsx';
import type { ManagedSource, SkillTreeSubject } from './skill-tree-model.ts';

const restoreActionLabel = 'Restore Original Version';

function restoreTargetLabel(source: ManagedSource): string {
    if (source === 'seeded') {
        return 'the Grotto default';
    }
    return 'the original Grotto version';
}

export interface SkillEnablementController {
    error: null | { message: string };
    isPending: boolean;
    mutate: (input: { enabled: boolean; skillId: string }) => void;
}

export function SkillDetailActions({
    setEnabled,
    scanBlocked,
    subject,
}: {
    scanBlocked: boolean;
    setEnabled: SkillEnablementController;
    subject: SkillTreeSubject;
}) {
    const install = useSkillHubInstall();
    const uninstall = useSkillHubUninstall();
    const reset = useSkillReset();
    const [conflictOpen, setConflictOpen] = React.useState(false);
    const [resetOpen, setResetOpen] = React.useState(false);

    const managedSource = subject.managedSource;
    // Hub skills replace via install-with-force; seeded skills regenerate via reset.
    const isHubManaged = managedSource === 'hub' && Boolean(subject.identifier);

    const canUninstall = Boolean(subject.installed && subject.uninstallName);
    const canReset = subject.installed && managedSource != null;
    const showUpdate = subject.installed && subject.updateAvailable && managedSource != null;
    const showInstall = !subject.installed && Boolean(subject.identifier);
    const mutationBusy = install.isPending || uninstall.isPending || reset.isPending;

    function runUpdate(force: boolean) {
        if (!subject.identifier) {
            return;
        }
        install.mutate(
            { force, identifier: subject.identifier },
            {
                onError: (error) => showSkillFailureToast('Update failed', error),
                onSuccess: (result) => {
                    if (result.conflict) {
                        setConflictOpen(true);
                        return;
                    }
                    setConflictOpen(false);
                    toastManager.add({ title: 'Skill updated', type: 'success' });
                },
            }
        );
    }

    function runReset(closeConflict = false) {
        if (!subject.skillId) {
            return;
        }
        reset.mutate(
            { skillId: subject.skillId },
            {
                onError: (error) => showSkillFailureToast('Restore failed', error),
                onSuccess: () => {
                    setResetOpen(false);
                    if (closeConflict) {
                        setConflictOpen(false);
                    }
                    toastManager.add({ title: 'Skill restored', type: 'success' });
                },
            }
        );
    }

    // Update entry point: hub runs the conflict-gated install flow; plugin/seeded
    // regenerate via reset, confirming first only when the skill has local edits.
    function onUpdate() {
        if (isHubManaged) {
            runUpdate(false);
            return;
        }
        if (subject.edited) {
            setConflictOpen(true);
            return;
        }
        runReset();
    }

    function onConflictReplace() {
        if (isHubManaged) {
            runUpdate(true);
            return;
        }
        runReset(true);
    }

    function runUninstall() {
        if (!subject.uninstallName) {
            return;
        }
        uninstall.mutate(
            { name: subject.uninstallName },
            { onError: (error) => showSkillFailureToast('Uninstall failed', error) }
        );
    }

    return (
        <div className="flex shrink-0 items-center gap-1.5">
            {subject.installed && subject.skillId && !subject.readOnly ? (
                <SkillEnableSwitch
                    enabled={subject.enabled === true}
                    name={subject.name}
                    setEnabled={setEnabled}
                    skillId={subject.skillId}
                />
            ) : null}
            {showUpdate ? (
                <Button disabled={mutationBusy} onClick={onUpdate} size="sm" variant="secondary">
                    {install.isPending || reset.isPending ? (
                        <Spinner className="size-4" />
                    ) : (
                        <Icon icon={RefreshIcon} />
                    )}
                    Update
                </Button>
            ) : null}
            {showInstall ? (
                <Button
                    disabled={install.isPending || scanBlocked}
                    onClick={() => runUpdate(false)}
                    size="sm"
                    title={scanBlocked ? 'The security scan blocked this skill.' : undefined}
                >
                    {install.isPending ? (
                        <Spinner className="size-4" />
                    ) : (
                        <Icon icon={AddCircleIcon} />
                    )}
                    Install
                </Button>
            ) : null}
            {canUninstall || canReset ? (
                <Menu>
                    <MenuTrigger
                        render={
                            <Button
                                aria-label={`${subject.name} actions`}
                                className="text-foreground"
                                size="icon-sm"
                                title="Skill actions"
                                variant="ghost"
                            />
                        }
                    >
                        <Icon className="size-4" icon={MoreHorizontalIcon} />
                    </MenuTrigger>
                    <MenuPopup align="end">
                        {canReset && managedSource ? (
                            <MenuItem disabled={mutationBusy} onClick={() => setResetOpen(true)}>
                                <Icon className="size-4" icon={ArrowReloadHorizontalIcon} />
                                {restoreActionLabel}
                            </MenuItem>
                        ) : null}
                        {canUninstall ? (
                            <MenuItem disabled={mutationBusy} onClick={runUninstall}>
                                {uninstall.isPending ? (
                                    <Spinner className="size-4" />
                                ) : (
                                    <Icon className="size-4" icon={Delete02Icon} />
                                )}
                                Uninstall
                            </MenuItem>
                        ) : null}
                    </MenuPopup>
                </Menu>
            ) : null}

            <UpdateConflictDialog
                busy={install.isPending || reset.isPending}
                name={subject.name}
                onKeep={() => setConflictOpen(false)}
                onOpenChange={setConflictOpen}
                onReplace={onConflictReplace}
                open={conflictOpen}
                restoreTarget={restoreTargetLabel(managedSource ?? 'hub')}
            />
            <ResetConfirmDialog
                actionLabel={restoreActionLabel}
                name={subject.name}
                onConfirm={() => runReset()}
                onOpenChange={setResetOpen}
                open={resetOpen}
                resetting={reset.isPending}
                restoreTarget={restoreTargetLabel(managedSource ?? 'seeded')}
            />
        </div>
    );
}
