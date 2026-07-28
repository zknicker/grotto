import { useEffect, useMemo, useState } from 'react';
import type { AppCommand, AppCommandGroup } from '../../commands/types.ts';
import { getCommandSearchText } from '../../commands/types.ts';
import { useAppCommands } from '../../commands/use-app-commands.ts';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { TavernLogo } from '../../components/tavern-logo.tsx';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import {
    Command,
    CommandCollection,
    CommandDialog,
    CommandDialogPopup,
    CommandEmpty,
    CommandFooter,
    CommandGroup,
    CommandGroupLabel,
    CommandInput,
    CommandItem,
    CommandList,
    CommandShortcut,
} from '../../components/ui/command.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import {
    type AgentFaceAppearance,
    useAgentAppearanceLookup,
} from '../../hooks/agents/use-agent-appearance.ts';
import { cn } from '../../lib/utils.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace } from '../chats/agent-face.tsx';
import { getChannelColorStyle } from './channel-color-options.ts';

/**
 * Global command menu (Cmd+K / Ctrl+K). The menu renders modular command
 * groups from `src/commands`; command modules own navigation, feature, and
 * developer action definitions while this component owns only the shell.
 */
export function CommandMenu() {
    const commandGroups = useAppCommands();
    const lookupAppearance = useAgentAppearanceLookup();

    return <CommandMenuShell commandGroups={commandGroups} lookupAppearance={lookupAppearance} />;
}

export function CommandMenuShell({
    commandGroups,
    lookupAppearance,
}: {
    commandGroups: AppCommandGroup[];
    lookupAppearance: (agentId: string | null | undefined) => AgentFaceAppearance;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const dark = useResolvedThemeOptional() === 'dark';
    const visibleCommandGroups = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            return commandGroups;
        }

        return commandGroups
            .map((group) => ({
                ...group,
                commands: group.commands.filter((command) =>
                    getCommandSearchText(command).toLowerCase().includes(normalizedQuery)
                ),
            }))
            .filter((group) => group.commands.length > 0);
    }, [commandGroups, query]);
    const commands = useMemo(
        () => visibleCommandGroups.flatMap((group) => group.commands),
        [visibleCommandGroups]
    );

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                setOpen((current) => !current);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <CommandDialog
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);

                if (!nextOpen) {
                    setQuery('');
                }
            }}
            open={open}
        >
            <CommandDialogPopup aria-label="Command menu" className="max-w-2xl">
                <Command
                    items={commands}
                    itemToStringValue={(item) => getCommandSearchText(item as AppCommand)}
                >
                    <CommandInput
                        onChange={(event) => setQuery(event.currentTarget.value)}
                        placeholder="Search or run a command..."
                    />
                    <CommandList>
                        <CommandEmpty>No matching commands.</CommandEmpty>
                        {visibleCommandGroups.map((group) => (
                            <CommandGroup key={group.id}>
                                <CommandGroupLabel>{group.title}</CommandGroupLabel>
                                <CommandCollection>
                                    {(command: AppCommand) => {
                                        if (
                                            !group.commands.some((item) => item.id === command.id)
                                        ) {
                                            return null;
                                        }

                                        return (
                                            <CommandItem
                                                disabled={Boolean(command.disabledReason)}
                                                key={command.id}
                                                onClick={() => {
                                                    if (command.disabledReason) {
                                                        return;
                                                    }

                                                    void command.run();
                                                    setOpen(false);
                                                }}
                                                value={command}
                                            >
                                                <CommandMenuIcon
                                                    command={command}
                                                    dark={dark}
                                                    disabled={Boolean(command.disabledReason)}
                                                    lookupAppearance={lookupAppearance}
                                                />
                                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                    <span className="truncate font-medium">
                                                        {command.title}
                                                    </span>
                                                    {command.disabledReason ? (
                                                        <span className="truncate text-muted-foreground text-xs">
                                                            {command.disabledReason}
                                                        </span>
                                                    ) : null}
                                                </span>
                                                {command.shortcut ? (
                                                    <CommandShortcut>
                                                        {command.shortcut}
                                                    </CommandShortcut>
                                                ) : null}
                                            </CommandItem>
                                        );
                                    }}
                                </CommandCollection>
                            </CommandGroup>
                        ))}
                    </CommandList>
                    <CommandFooter>
                        <span className="flex items-center gap-2">
                            <kbd className="rounded-md border bg-background px-1.5 py-0.5 font-medium">
                                Return
                            </kbd>
                            Run
                        </span>
                        <span className="flex items-center gap-2">
                            <kbd className="rounded-md border bg-background px-1.5 py-0.5 font-medium">
                                Esc
                            </kbd>
                            Close
                        </span>
                    </CommandFooter>
                </Command>
            </CommandDialogPopup>
        </CommandDialog>
    );
}

const commandAgentFaceStyle = {
    flexShrink: 0,
    height: 24,
    overflow: 'visible',
    width: 24,
} as const;

function CommandMenuIcon({
    command,
    dark,
    disabled,
    lookupAppearance,
}: {
    command: AppCommand;
    dark: boolean;
    disabled: boolean;
    lookupAppearance: (agentId: string | null | undefined) => AgentFaceAppearance;
}) {
    const className = cn(
        'size-5 shrink-0 text-muted-foreground transition-colors',
        disabled && 'opacity-60',
        !disabled && 'group-data-highlighted:text-accent-foreground'
    );

    if (command.icon === 'tavern') {
        return <TavernLogo aria-hidden="true" className={className} />;
    }

    if (typeof command.icon === 'object' && 'kind' in command.icon) {
        if (command.icon.kind === 'channel') {
            return (
                <ChannelIconBox
                    className={disabled ? 'opacity-60' : undefined}
                    size="inline"
                    style={getChannelColorStyle(command.icon.color)}
                />
            );
        }

        const appearance = lookupAppearance(command.icon.agentId);

        if (appearance.character !== 'none') {
            return (
                <span
                    aria-hidden="true"
                    className={cn(
                        'flex size-5 shrink-0 items-center justify-center',
                        disabled && 'opacity-60'
                    )}
                >
                    <AgentFace
                        animate={false}
                        dark={dark}
                        head={appearance.character}
                        ink={resolveAgentInk(dark, appearance.primaryColor)}
                        size={24}
                        style={commandAgentFaceStyle}
                    />
                </span>
            );
        }

        return (
            <span
                aria-hidden="true"
                className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-[0.4375rem] bg-muted font-medium text-[0.625rem] text-muted-foreground',
                    disabled && 'opacity-60'
                )}
            >
                {(command.icon.fallbackLabel.trim()[0] ?? '?').toUpperCase()}
            </span>
        );
    }

    return <Icon aria-hidden="true" className={className} icon={command.icon} size={20} />;
}
