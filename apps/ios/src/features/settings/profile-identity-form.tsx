import { Button } from 'heroui-native/button';
import { Spinner } from 'heroui-native/spinner';
import { useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { SettingsField } from '../../components/settings-field.tsx';

export function ProfileIdentityForm({
    description,
    displayName,
    error,
    isPending,
    onEditDescription,
    onSave,
}: {
    description: string;
    displayName: string;
    error: string | null;
    isPending: boolean;
    onEditDescription: () => void;
    onSave: (profile: { description: string; displayName: string }) => Promise<unknown>;
}) {
    const [nameDraft, setNameDraft] = useState(displayName);
    const trimmedName = nameDraft.trim();
    const isNameInvalid = nameDraft.length > 0 && trimmedName.length === 0;
    const didNameChange = trimmedName !== displayName;

    const saveName = async () => {
        try {
            await onSave({ description, displayName: trimmedName });
            setNameDraft(trimmedName);
        } catch {
            // The mutation error remains visible beside the field.
        }
    };

    return (
        <View className="gap-4">
            <SettingsField.Root isInvalid={isNameInvalid} isRequired>
                <SettingsField.Label>Name</SettingsField.Label>
                <SettingsField.Control>
                    <SettingsField.Input
                        autoCapitalize="words"
                        containerClassName="flex-1"
                        isDisabled={isPending}
                        maxLength={80}
                        onChangeText={setNameDraft}
                        onSubmitEditing={() => {
                            if (didNameChange && !isNameInvalid && trimmedName.length > 0) {
                                void saveName();
                            }
                        }}
                        returnKeyType="done"
                        value={nameDraft}
                    />
                    {didNameChange ? (
                        <Button
                            isDisabled={isPending || isNameInvalid || trimmedName.length === 0}
                            onPress={() => void saveName()}
                            size="sm"
                            variant="primary"
                        >
                            {isPending ? <Spinner size="sm" /> : null}
                            <Button.Label>Save</Button.Label>
                        </Button>
                    ) : null}
                </SettingsField.Control>
                <SettingsField.Error>Name cannot be blank.</SettingsField.Error>
            </SettingsField.Root>

            <SettingsField.Root>
                <SettingsField.Label>Description</SettingsField.Label>
                <SettingsField.Ingress
                    accessibilityLabel="Edit description"
                    accessibilityRole="button"
                    onPress={() => {
                        Keyboard.dismiss();
                        onEditDescription();
                    }}
                >
                    {description ? (
                        <SettingsField.Value numberOfLines={2}>{description}</SettingsField.Value>
                    ) : (
                        <SettingsField.Placeholder>No description yet.</SettingsField.Placeholder>
                    )}
                </SettingsField.Ingress>
            </SettingsField.Root>
            {error ? <Text className="text-danger text-sm">{error}</Text> : null}
        </View>
    );
}
