import type { IconSvgElement } from '@hugeicons/react';
import type { ChatListItem } from '../features/chats/chat-list-data.ts';
import type { CapabilityRequirement, CapabilityView } from '../hooks/connections/use-capability.ts';

export type AppCommandIcon =
    | IconSvgElement
    | 'tavern'
    | {
          color: string | null;
          kind: 'channel';
      }
    | {
          agentId: string | null;
          fallbackLabel: string;
          kind: 'agent-avatar';
      };

export interface AppCommand {
    disabledReason?: string | null;
    icon: AppCommandIcon;
    id: string;
    keywords?: readonly string[];
    run: () => void | Promise<void>;
    shortcut?: string;
    subtitle?: string;
    title: string;
}

export interface AppCommandGroup {
    commands: readonly AppCommand[];
    id: string;
    title: string;
}

export interface AppCommandBuildContext {
    chats: readonly ChatListItem[];
    currentChat: ChatListItem | null;
    devMode: boolean;
    navigate: (path: string) => void;
    pathname: string;
    resolveCapability: (requirement: CapabilityRequirement) => CapabilityView;
    setDevMode: (devMode: boolean) => void;
}

export function getCommandSearchText(command: AppCommand) {
    return [command.title, command.subtitle, ...(command.keywords ?? [])]
        .filter(Boolean)
        .join('\n');
}

export function filterCommandGroups(groups: readonly AppCommandGroup[]) {
    return groups
        .map((group) => ({
            ...group,
            commands: group.commands.filter(Boolean),
        }))
        .filter((group) => group.commands.length > 0);
}
