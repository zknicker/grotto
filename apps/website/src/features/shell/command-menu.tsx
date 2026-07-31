import { Kbd } from '@heroui/react';
import { Command } from '@heroui-pro/react';
import { Search01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useEffect, useMemo, useState } from 'react';
import type { AppCommand, AppCommandGroup } from '../../commands/types.ts';
import { getCommandSearchText } from '../../commands/types.ts';
import { useAppCommands } from '../../commands/use-app-commands.ts';
import { ChannelIconBox } from '../../components/chats/channel-icon-box.tsx';
import { TavernLogo } from '../../components/tavern-logo.tsx';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import {
    type AgentFaceAppearance,
    useAgentAppearanceLookup,
} from '../../hooks/agents/use-agent-appearance.ts';
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
    const commandsById = useMemo(() => {
        const lookup = new Map<string, AppCommand>();

        for (const group of commandGroups) {
            for (const command of group.commands) {
                lookup.set(command.id, command);
            }
        }

        return lookup;
    }, [commandGroups]);

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

    const runCommand = (key: string | number) => {
        const command = commandsById.get(String(key));

        if (!command || command.disabledReason) {
            return;
        }

        void command.run();
        setOpen(false);
    };

    return (
        <Command>
            <Command.Backdrop
                isOpen={open}
                onOpenChange={(nextOpen) => {
                    setOpen(nextOpen);

                    if (!nextOpen) {
                        setQuery('');
                    }
                }}
            >
                <Command.Container size="lg">
                    <Command.Dialog
                        aria-label="Command menu"
                        inputValue={query}
                        onInputChange={setQuery}
                    >
                        <Command.InputGroup>
                            <Command.InputGroup.Prefix>
                                <Icon icon={Search01Icon} />
                            </Command.InputGroup.Prefix>
                            <Command.InputGroup.Input placeholder="Search or run a command..." />
                            <Command.InputGroup.ClearButton />
                        </Command.InputGroup>
                        <Command.List
                            aria-label="Commands"
                            onAction={runCommand}
                            renderEmptyState={() => 'No matching commands.'}
                        >
                            {commandGroups.map((group) => (
                                <Command.Group heading={group.title} key={group.id}>
                                    {group.commands.map((command) => (
                                        <Command.Item
                                            id={command.id}
                                            isDisabled={Boolean(command.disabledReason)}
                                            key={command.id}
                                            textValue={getCommandSearchText(command)}
                                        >
                                            <CommandMenuIcon
                                                command={command}
                                                dark={dark}
                                                lookupAppearance={lookupAppearance}
                                            />
                                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                <span className="truncate font-medium">
                                                    {command.title}
                                                </span>
                                                {command.disabledReason ? (
                                                    <span className="truncate text-muted text-xs">
                                                        {command.disabledReason}
                                                    </span>
                                                ) : null}
                                            </span>
                                            {command.shortcut ? (
                                                <kbd>{command.shortcut}</kbd>
                                            ) : null}
                                        </Command.Item>
                                    ))}
                                </Command.Group>
                            ))}
                        </Command.List>
                        <Command.Footer>
                            <span className="flex items-center gap-2">
                                <Kbd>
                                    <Kbd.Content>Return</Kbd.Content>
                                </Kbd>
                                Run
                            </span>
                            <span className="flex items-center gap-2">
                                <Kbd>
                                    <Kbd.Content>Esc</Kbd.Content>
                                </Kbd>
                                Close
                            </span>
                        </Command.Footer>
                    </Command.Dialog>
                </Command.Container>
            </Command.Backdrop>
        </Command>
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
    lookupAppearance,
}: {
    command: AppCommand;
    dark: boolean;
    lookupAppearance: (agentId: string | null | undefined) => AgentFaceAppearance;
}) {
    if (command.icon === 'tavern') {
        return <TavernLogo aria-hidden="true" />;
    }

    if (typeof command.icon === 'object' && 'kind' in command.icon) {
        if (command.icon.kind === 'channel') {
            return (
                <ChannelIconBox size="inline" style={getChannelColorStyle(command.icon.color)} />
            );
        }

        const appearance = lookupAppearance(command.icon.agentId);

        if (appearance.character !== 'none') {
            return (
                <span
                    aria-hidden="true"
                    className="flex size-5 shrink-0 items-center justify-center"
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
                className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-secondary font-medium text-muted text-xs"
            >
                {(command.icon.fallbackLabel.trim()[0] ?? '?').toUpperCase()}
            </span>
        );
    }

    return <Icon aria-hidden="true" icon={command.icon} />;
}
