import { useAgentProfileUpdate, useMemberProfileUpdate } from '@tavern/app-client';
import { useState } from 'react';
import { Keyboard, View } from 'react-native';
import { TextEditorScreen } from '../../components/text-editor-screen.tsx';
import { SettingsBackHeader } from './settings-screen-header.tsx';

interface DescriptionEditorProps {
    description: string;
    displayName: string;
    error: string | null;
    isPending: boolean;
    onBack: () => void;
    save: (profile: { description: string; displayName: string }) => Promise<unknown>;
}

export function MemberDescriptionSettingsScreen({
    description,
    displayName,
    memberId,
    onBack,
    serverId,
}: {
    description: string;
    displayName: string;
    memberId: string;
    onBack: () => void;
    serverId: string;
}) {
    const profile = useMemberProfileUpdate(serverId, memberId);
    return (
        <DescriptionEditor
            description={description}
            displayName={displayName}
            error={profile.error?.message ?? null}
            isPending={profile.isPending}
            onBack={onBack}
            save={profile.save}
        />
    );
}

export function AgentDescriptionSettingsScreen({
    agentId,
    description,
    displayName,
    onBack,
    serverId,
}: {
    agentId: string;
    description: string;
    displayName: string;
    onBack: () => void;
    serverId: string;
}) {
    const profile = useAgentProfileUpdate(serverId, agentId);
    return (
        <DescriptionEditor
            description={description}
            displayName={displayName}
            error={profile.error?.message ?? null}
            isPending={profile.isPending}
            onBack={onBack}
            save={profile.save}
        />
    );
}

function DescriptionEditor({
    description,
    displayName,
    error,
    isPending,
    onBack,
    save,
}: DescriptionEditorProps) {
    const [draft, setDraft] = useState(description);

    const leave = () => {
        Keyboard.dismiss();
        onBack();
    };

    const submit = async () => {
        const trimmedDraft = draft.trim();
        if (trimmedDraft === description) {
            leave();
            return;
        }

        try {
            await save({ description: trimmedDraft, displayName });
            leave();
        } catch {
            // The focused mutation owns the visible error state.
        }
    };

    return (
        <View className="flex-1">
            <SettingsBackHeader onBack={leave} title="Description" />
            <TextEditorScreen.Root>
                <TextEditorScreen.Textarea
                    accessibilityHint="Shown on this Server profile."
                    accessibilityLabel="Description"
                    autoCapitalize="sentences"
                    isDisabled={isPending}
                    maxLength={500}
                    onChangeText={setDraft}
                    placeholder="Add a description…"
                    value={draft}
                />
                {error ? <TextEditorScreen.Error>{error}</TextEditorScreen.Error> : null}
                <TextEditorScreen.Actions>
                    <TextEditorScreen.Submit
                        accessibilityLabel="Save description"
                        isPending={isPending}
                        onPress={() => void submit()}
                    />
                </TextEditorScreen.Actions>
            </TextEditorScreen.Root>
        </View>
    );
}
