import { PlusSignIcon } from '@hugeicons-pro/core-solid-rounded';
import { FileSearchIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import {
    Menu,
    MenuGroup,
    MenuGroupLabel,
    MenuItem,
    MenuPopup,
    MenuTrigger,
} from '../../components/ui/menu.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import type { TavernResourceTarget } from './tavern-resource-link.ts';

export function ArtifactPanelSourceMenu({
    agentId,
    onOpenTarget,
}: {
    agentId: string;
    onOpenTarget: (target: TavernResourceTarget) => void;
}) {
    return (
        <Menu>
            <MenuTrigger
                aria-label="Open from source"
                render={
                    <Button
                        className="text-muted-foreground hover:text-foreground"
                        size="icon-sm"
                        variant="ghost"
                    />
                }
                title="Open from source"
            >
                <Icon aria-hidden="true" className="size-3.5" icon={PlusSignIcon} />
            </MenuTrigger>
            <MenuPopup align="end" className="w-64">
                <MenuGroup>
                    <MenuGroupLabel>Open from</MenuGroupLabel>
                    <MenuItem
                        className="items-start gap-2 py-2"
                        disabled={!agentId}
                        onClick={() =>
                            onOpenTarget({
                                agentId,
                                kind: 'workspaceDirectory',
                                path: '',
                            })
                        }
                    >
                        <Icon className="mt-0.5" icon={FileSearchIcon} />
                        <SourceMenuText
                            description={
                                agentId
                                    ? 'Browse files in this agent workspace'
                                    : 'No active agent workspace'
                            }
                            title="Workspace"
                        />
                    </MenuItem>
                </MenuGroup>
            </MenuPopup>
        </Menu>
    );
}

function SourceMenuText({ description, title }: { description: string; title: string }) {
    return (
        <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium leading-4">{title}</span>
            <span className="truncate text-meta text-muted-foreground leading-4">
                {description}
            </span>
        </span>
    );
}
