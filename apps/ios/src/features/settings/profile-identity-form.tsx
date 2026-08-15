import { Button } from 'heroui-native/button';
import { ListGroup } from 'heroui-native/list-group';
import { Spinner } from 'heroui-native/spinner';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SettingsField } from '../../components/settings-field.tsx';
import { TextEditorSheet } from '../../components/text-editor-sheet.tsx';

export function ProfileIdentityForm({
    description,
    descriptionHint,
    displayName,
    error,
    isPending,
    onSave,
}: {
    description: string;
    descriptionHint: string;
    displayName: string;
    error: string | null;
    isPending: boolean;
    onSave: (profile: { description: string; displayName: string }) => Promise<unknown>;
}) {
    const [nameDraft, setNameDraft] = useState(displayName);
    const [descriptionDraft, setDescriptionDraft] = useState(description);
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
    const trimmedName = nameDraft.trim();
    const isNameInvalid = nameDraft.length > 0 && trimmedName.length === 0;
    const didNameChange = trimmedName !== displayName;

    const saveName = async () => {
        try {
            await onSave({ description, displayName: nameDraft });
        } catch {
            // The mutation error remains visible beside the field.
        }
    };

    const editDescription = () => {
        setDescriptionDraft(description);
        setIsDescriptionOpen(true);
    };

    return (
        <>
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

                <ListGroup>
                    <ListGroup.Item
                        accessibilityLabel="Edit description"
                        accessibilityRole="button"
                        onPress={editDescription}
                    >
                        <ListGroup.ItemContent>
                            <ListGroup.ItemTitle>Description</ListGroup.ItemTitle>
                            <ListGroup.ItemDescription numberOfLines={2}>
                                {description || 'No description yet.'}
                            </ListGroup.ItemDescription>
                        </ListGroup.ItemContent>
                        <ListGroup.ItemSuffix />
                    </ListGroup.Item>
                </ListGroup>
                {error ? <Text className="text-danger text-sm">{error}</Text> : null}
            </View>

            <DescriptionEditor
                description={description}
                descriptionHint={descriptionHint}
                displayName={displayName}
                draft={descriptionDraft}
                error={error}
                isOpen={isDescriptionOpen}
                isPending={isPending}
                onChange={setDescriptionDraft}
                onOpenChange={(isOpen) => {
                    if (!(isOpen || isPending)) {
                        setIsDescriptionOpen(false);
                    }
                }}
                onSave={onSave}
                onSaved={() => setIsDescriptionOpen(false)}
            />
        </>
    );
}

function DescriptionEditor({
    description,
    descriptionHint,
    displayName,
    draft,
    error,
    isOpen,
    isPending,
    onChange,
    onOpenChange,
    onSave,
    onSaved,
}: {
    description: string;
    descriptionHint: string;
    displayName: string;
    draft: string;
    error: string | null;
    isOpen: boolean;
    isPending: boolean;
    onChange: (value: string) => void;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (profile: { description: string; displayName: string }) => Promise<unknown>;
    onSaved: () => void;
}) {
    const save = async () => {
        if (draft.trim() === description) {
            onSaved();
            return;
        }

        try {
            await onSave({ description: draft, displayName });
            onSaved();
        } catch {
            // The mutation error remains visible in this editor.
        }
    };

    return (
        <TextEditorSheet.Root isOpen={isOpen} onOpenChange={onOpenChange}>
            <TextEditorSheet.Title>Description</TextEditorSheet.Title>
            <TextEditorSheet.Textarea
                accessibilityHint={descriptionHint}
                accessibilityLabel="Description"
                autoCapitalize="sentences"
                isDisabled={isPending}
                maxLength={500}
                onChangeText={onChange}
                placeholder="Add a description…"
                value={draft}
            />
            {error ? <TextEditorSheet.Error>{error}</TextEditorSheet.Error> : null}
            <TextEditorSheet.Actions>
                <TextEditorSheet.Submit
                    accessibilityLabel="Save description"
                    isPending={isPending}
                    onPress={() => void save()}
                />
            </TextEditorSheet.Actions>
        </TextEditorSheet.Root>
    );
}
