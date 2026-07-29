import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import {
    Cancel01Icon,
    Copy01Icon,
    File01Icon,
    MoreHorizontalIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { CloseableTab } from '../../components/ui/closeable-tab.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import {
    Menu,
    MenuItem,
    MenuPopup,
    MenuSeparator,
    MenuTrigger,
} from '../../components/ui/menu.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { cn } from '../../lib/utils.ts';
import { ArtifactPanelSourceMenu } from './chat-artifact-panel-source-menu.tsx';
import {
    formatTavernResourceLink,
    getArtifactPanelTargetKey,
    getArtifactPanelTargetLabel,
    type TavernResourceTarget,
} from './tavern-resource-link.ts';

// One chrome row: tabs, the active target's options, add, hide. The pane
// intentionally has no second path/toolbar row — target navigation lives in
// the content browsers themselves. In the tabs layout this row renders
// inside the shell toolbar, aligned over the pane; in the sidebar layout the
// pane hosts it directly.
export function ArtifactPanelChrome({
    activeKey,
    activeTarget,
    agentId,
    className,
    // Hidden when a toolbar-hosted toggle button plays the hide role instead.
    closeButtonHidden = false,
    onClose,
    onCloseTarget,
    onOpenTarget,
    targets,
}: {
    activeKey: string | null;
    activeTarget?: TavernResourceTarget;
    agentId: string;
    className?: string;
    closeButtonHidden?: boolean;
    onClose: () => void;
    onCloseTarget: (key: string) => void;
    onOpenTarget: (target: TavernResourceTarget) => void;
    targets: TavernResourceTarget[];
}) {
    return (
        <div className={cn('flex h-full min-w-0 flex-1 items-center gap-2 px-3', className)}>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <ScrollArea className="h-7 min-w-0 flex-1" orientation="horizontal">
                    <TabsPrimitive.List
                        aria-label="Open artifacts"
                        className="flex h-7 w-max min-w-full items-center gap-1"
                    >
                        {targets.map((target) => {
                            const key = getArtifactPanelTargetKey(target);
                            return (
                                <ArtifactPanelTab
                                    active={key === activeKey}
                                    key={key}
                                    onClose={() => onCloseTarget(key)}
                                    target={target}
                                    value={key}
                                />
                            );
                        })}
                    </TabsPrimitive.List>
                </ScrollArea>
                <ArtifactPanelSourceMenu agentId={agentId} onOpenTarget={onOpenTarget} />
            </div>
            {activeTarget ? <ArtifactOptionsMenu target={activeTarget} /> : null}
            {closeButtonHidden ? null : (
                <Button
                    aria-label="Hide artifacts"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={onClose}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                >
                    <Icon className="size-3.5" icon={Cancel01Icon} />
                </Button>
            )}
        </div>
    );
}

function ArtifactOptionsMenu({ target }: { target: TavernResourceTarget }) {
    return (
        <Menu>
            <MenuTrigger
                aria-label="Artifact options"
                render={
                    <Button
                        className="text-muted-foreground hover:text-foreground"
                        size="icon-sm"
                        variant="ghost"
                    />
                }
            >
                <Icon className="size-3.5" icon={MoreHorizontalIcon} />
            </MenuTrigger>
            <MenuPopup align="end" className="w-44">
                <MenuItem onClick={() => void copyArtifactText(formatTavernResourceLink(target))}>
                    <Icon icon={Copy01Icon} />
                    Copy link
                </MenuItem>
                <MenuSeparator />
                <MenuItem onClick={() => void copyArtifactText(target.path)}>Copy path</MenuItem>
            </MenuPopup>
        </Menu>
    );
}

function ArtifactPanelTab({
    active,
    onClose,
    target,
    value,
}: {
    active: boolean;
    onClose: () => void;
    target: TavernResourceTarget;
    value: string;
}) {
    const label = getArtifactPanelTargetLabel(target);

    return (
        // text-meta rides the wrapper: merging a size token with the tab's
        // color classes would collapse them into one utility.
        <CloseableTab
            className="min-w-0 max-w-40 shrink-0 text-meta"
            closeLabel={`Close ${label}`}
            onClose={onClose}
        >
            <TabsPrimitive.Tab
                className={cn(
                    'flex h-7 w-full min-w-0 items-center gap-1.5 rounded-lg py-0 pr-7 pl-2.5 outline-none transition-[background-color,box-shadow,color] focus-visible:bg-muted',
                    active
                        ? 'bg-active text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                title={target.path}
                value={value}
            >
                <Icon aria-hidden="true" className="size-3.5 shrink-0" icon={File01Icon} />
                <span className="min-w-0 truncate">{label}</span>
            </TabsPrimitive.Tab>
        </CloseableTab>
    );
}

async function copyArtifactText(value: string) {
    if (navigator.clipboard) {
        try {
            await navigator.clipboard.writeText(value);
            return;
        } catch {
            // Fall through to the textarea copy path for stricter webviews.
        }
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.append(textarea);
    textarea.select();

    try {
        document.execCommand('copy');
    } finally {
        textarea.remove();
    }
}
