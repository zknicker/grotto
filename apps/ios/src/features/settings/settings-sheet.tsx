import { useRouter } from 'expo-router';
import { BottomSheet } from 'heroui-native/bottom-sheet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { SheetStack } from '../../components/sheet-stack.tsx';
import { AgentProfileScreen } from './agent-profile-screen.tsx';
import { AppSettingsScreen } from './app-settings-screen.tsx';
import {
    AgentDescriptionSettingsScreen,
    MemberDescriptionSettingsScreen,
} from './description-settings-screen.tsx';
import { ProfileSettingsScreen } from './profile-settings-screen.tsx';
import { ServerSettingsScreen } from './server-settings-screen.tsx';
import { SettingsScreen } from './settings-screen.tsx';

type SettingsDestination =
    | { key: string; name: 'settings' }
    | { key: string; name: 'profile' }
    | { key: string; name: 'server' }
    | { key: string; name: 'app' }
    | { agentId: string; key: string; name: 'agent' }
    | {
          description: string;
          displayName: string;
          key: string;
          memberId: string;
          name: 'member-description';
      }
    | {
          agentId: string;
          description: string;
          displayName: string;
          key: string;
          name: 'agent-description';
      };

const ROOT_DESTINATION = { key: 'settings', name: 'settings' } as const;

interface SettingsNavigation {
    activeIndex: number;
    entries: SettingsDestination[];
}

const ROOT_NAVIGATION: SettingsNavigation = {
    activeIndex: 0,
    entries: [ROOT_DESTINATION],
};

export function SettingsSheet({
    hostName,
    isOpen,
    onOpenChange,
    serverId,
}: {
    hostName: string;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    serverId: string;
}) {
    const router = useRouter();
    const [navigation, setNavigation] = useState<SettingsNavigation>(ROOT_NAVIGATION);
    const destinationSequence = useRef(0);

    useEffect(() => {
        if (isOpen) {
            return;
        }
        const resetTimer = setTimeout(() => {
            destinationSequence.current = 0;
            setNavigation(ROOT_NAVIGATION);
        }, 300);
        return () => clearTimeout(resetTimer);
    }, [isOpen]);

    const push = useCallback((next: SettingsDestination) => {
        destinationSequence.current += 1;
        const entry = { ...next, key: `${next.key}:${destinationSequence.current}` };
        setNavigation((current) => ({
            activeIndex: current.activeIndex + 1,
            entries: [...current.entries.slice(0, current.activeIndex + 1), entry],
        }));
    }, []);

    const pop = useCallback(() => {
        setNavigation((current) => ({
            ...current,
            activeIndex: Math.max(0, current.activeIndex - 1),
        }));
    }, []);

    const close = useCallback(() => onOpenChange(false), [onOpenChange]);

    const openSection = (sectionId: string) => {
        close();
        router.push({ pathname: '/section/[id]', params: { id: sectionId } });
    };

    return (
        <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
            <BottomSheet.Portal hostName={hostName}>
                <BottomSheet.Overlay />
                <BottomSheet.Content
                    backgroundClassName="bg-background"
                    contentContainerClassName="h-full px-0 pt-0"
                    contentContainerProps={{ style: { paddingBottom: 0 } }}
                    enableDynamicSizing={false}
                    enableOverDrag={false}
                    keyboardBehavior="extend"
                    snapPoints={['92%']}
                >
                    <SheetStack activeIndex={navigation.activeIndex}>
                        {navigation.entries.map((destination) => (
                            <View className="flex-1" key={destination.key}>
                                {destination.name === 'settings' ? (
                                    <SettingsScreen
                                        onClose={close}
                                        onOpenAgent={(agentId) =>
                                            push({
                                                agentId,
                                                key: `agent:${agentId}`,
                                                name: 'agent',
                                            })
                                        }
                                        onOpenApp={() => push({ key: 'app', name: 'app' })}
                                        onOpenProfile={() =>
                                            push({ key: 'profile', name: 'profile' })
                                        }
                                        onOpenSection={openSection}
                                        onOpenServer={() => push({ key: 'server', name: 'server' })}
                                        serverId={serverId}
                                    />
                                ) : null}
                                {destination.name === 'profile' ? (
                                    <ProfileSettingsScreen
                                        onBack={pop}
                                        onEditDescription={(profile) =>
                                            push({
                                                ...profile,
                                                key: `member-description:${profile.memberId}`,
                                                name: 'member-description',
                                            })
                                        }
                                        serverId={serverId}
                                    />
                                ) : null}
                                {destination.name === 'server' ? (
                                    <ServerSettingsScreen onBack={pop} serverId={serverId} />
                                ) : null}
                                {destination.name === 'app' ? (
                                    <AppSettingsScreen onBack={pop} />
                                ) : null}
                                {destination.name === 'agent' ? (
                                    <AgentProfileScreen
                                        agentId={destination.agentId}
                                        onBack={pop}
                                        onEditDescription={(profile) =>
                                            push({
                                                ...profile,
                                                key: `agent-description:${profile.agentId}`,
                                                name: 'agent-description',
                                            })
                                        }
                                        serverId={serverId}
                                    />
                                ) : null}
                                {destination.name === 'member-description' ? (
                                    <MemberDescriptionSettingsScreen
                                        description={destination.description}
                                        displayName={destination.displayName}
                                        memberId={destination.memberId}
                                        onBack={pop}
                                        serverId={serverId}
                                    />
                                ) : null}
                                {destination.name === 'agent-description' ? (
                                    <AgentDescriptionSettingsScreen
                                        agentId={destination.agentId}
                                        description={destination.description}
                                        displayName={destination.displayName}
                                        onBack={pop}
                                        serverId={serverId}
                                    />
                                ) : null}
                            </View>
                        ))}
                    </SheetStack>
                </BottomSheet.Content>
            </BottomSheet.Portal>
        </BottomSheet>
    );
}
