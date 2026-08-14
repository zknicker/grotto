import type { IconSvgElement } from '@hugeicons/react-native';
import {
    Activity01Icon,
    Archive02Icon,
    Attachment01Icon,
    Clock01Icon,
    ComputerIcon,
    MoreHorizontalIcon,
    Search01Icon,
    Settings01Icon,
    Task01Icon,
    UserGroupIcon,
} from '@hugeicons-pro/core-solid-rounded';
import { useLocalSearchParams } from 'expo-router';
import { Card } from 'heroui-native/card';
import { View } from 'react-native';
import { AppIcon } from './app-icon';
import { AppLayout } from './app-layout';
import { BackHeader } from './back-header';

interface SectionDescriptor {
    detail: string;
    icon: IconSvgElement;
    title: string;
}

const sections: Record<string, SectionDescriptor> = {
    activity: {
        detail: 'Recent agent and Computer activity.',
        icon: Activity01Icon,
        title: 'Activity',
    },
    attachments: {
        detail: 'Add photos and files to your message.',
        icon: Attachment01Icon,
        title: 'Attachments',
    },
    archived: {
        detail: 'Chats removed from the active list.',
        icon: Archive02Icon,
        title: 'Archived chats',
    },
    'chat-details': {
        detail: 'Participants, notifications, and chat-level controls.',
        icon: MoreHorizontalIcon,
        title: 'Chat details',
    },
    computers: {
        detail: 'Attached Computers and connection state.',
        icon: ComputerIcon,
        title: 'Computers',
    },
    members: {
        detail: 'People and Agents in this Grotto.',
        icon: UserGroupIcon,
        title: 'Members',
    },
    reminders: {
        detail: 'Scheduled follow-ups across Agents.',
        icon: Clock01Icon,
        title: 'Reminders',
    },
    search: {
        detail: 'Search chats, messages, and artifacts.',
        icon: Search01Icon,
        title: 'Search',
    },
    settings: {
        detail: 'Account, skills, connections, and app settings.',
        icon: Settings01Icon,
        title: 'Settings',
    },
    tasks: { detail: 'Assigned and agent-owned work.', icon: Task01Icon, title: 'Tasks' },
};

const fallback = sections.search;

export function SectionScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const section = sections[id] ?? fallback;

    return (
        <AppLayout.Root>
            <BackHeader title={section.title} />
            <AppLayout.Content>
                <View className="flex-1 p-4">
                    <Card>
                        <Card.Body>
                            <View className="mb-3 size-12 items-center justify-center rounded-2xl bg-accent-soft">
                                <AppIcon icon={section.icon} size={23} tone="accent" />
                            </View>
                            <Card.Title>{section.title}</Card.Title>
                            <Card.Description className="mt-1">{section.detail}</Card.Description>
                            <Card.Description className="mt-4 leading-5">
                                This native route will consume the same server contract and shared
                                capability hooks as desktop; only its rendering layer diverges.
                            </Card.Description>
                        </Card.Body>
                    </Card>
                </View>
            </AppLayout.Content>
        </AppLayout.Root>
    );
}
