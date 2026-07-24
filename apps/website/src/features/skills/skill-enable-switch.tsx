import * as React from 'react';
import {
    AlertDialog,
    AlertDialogClose,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogPopup,
    AlertDialogTitle,
} from '../../components/ui/alert-dialog.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import type { SkillEnablementController } from './skill-detail-actions.tsx';

export function SkillEnableSwitch({
    enabled,
    name,
    setEnabled,
    skillId,
}: {
    enabled: boolean;
    name: string;
    setEnabled: SkillEnablementController;
    skillId: string;
}) {
    const agents = useAgentList();
    const [confirming, setConfirming] = React.useState(false);
    const affected =
        agents.data?.agents.filter((agent) => agent.enabledSkillIds.includes(skillId)) ?? [];

    const change = (next: boolean) => {
        if (!next && affected.length > 0) {
            setConfirming(true);
            return;
        }
        setEnabled.mutate({ enabled: next, skillId });
    };

    return (
        <>
            <Switch
                aria-label={`${enabled ? 'Disable' : 'Enable'} ${name}`}
                checked={enabled}
                className="data-[checked]:bg-success"
                disabled={setEnabled.isPending}
                onCheckedChange={change}
            />
            <AlertDialog onOpenChange={setConfirming} open={confirming}>
                <AlertDialogPopup>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Disable {name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {affected.map((agent) => agent.name).join(', ')} will lose this skill.
                            Re-enabling it later will not restore their assignments.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogClose render={<Button variant="ghost" />}>
                            Cancel
                        </AlertDialogClose>
                        <AlertDialogClose
                            onClick={() => setEnabled.mutate({ enabled: false, skillId })}
                            render={<Button variant="destructive" />}
                        >
                            Disable
                        </AlertDialogClose>
                    </AlertDialogFooter>
                </AlertDialogPopup>
            </AlertDialog>
        </>
    );
}
