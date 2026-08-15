import { useBottomSheetAwareHandlers } from 'heroui-native';
import { BottomSheet } from 'heroui-native/bottom-sheet';
import { Button } from 'heroui-native/button';
import { Description } from 'heroui-native/description';
import { FieldError } from 'heroui-native/field-error';
import { Input } from 'heroui-native/input';
import { Label } from 'heroui-native/label';
import { ListGroup } from 'heroui-native/list-group';
import { Spinner } from 'heroui-native/spinner';
import { TextField } from 'heroui-native/text-field';
import { useState } from 'react';
import { Text, View } from 'react-native';

type ProfileField = 'description' | 'displayName';

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
    const [activeField, setActiveField] = useState<ProfileField | null>(null);
    const [draft, setDraft] = useState('');

    const edit = (field: ProfileField) => {
        setDraft(field === 'displayName' ? displayName : description);
        setActiveField(field);
    };

    return (
        <>
            <ListGroup>
                <ListGroup.Item
                    accessibilityLabel="Edit name"
                    accessibilityRole="button"
                    onPress={() => edit('displayName')}
                >
                    <ListGroup.ItemContent>
                        <ListGroup.ItemTitle>Name</ListGroup.ItemTitle>
                        <ListGroup.ItemDescription numberOfLines={1}>
                            {displayName}
                        </ListGroup.ItemDescription>
                    </ListGroup.ItemContent>
                    <ListGroup.ItemSuffix />
                </ListGroup.Item>
                <ListGroup.Item
                    accessibilityLabel="Edit description"
                    accessibilityRole="button"
                    onPress={() => edit('description')}
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

            <BottomSheet
                isOpen={activeField !== null}
                onOpenChange={(isOpen) => {
                    if (!(isOpen || isPending)) {
                        setActiveField(null);
                    }
                }}
            >
                <BottomSheet.Portal>
                    <BottomSheet.Overlay />
                    <BottomSheet.Content>
                        <BottomSheet.Close isDisabled={isPending} />
                        {activeField ? (
                            <ProfileFieldEditor
                                description={description}
                                descriptionHint={descriptionHint}
                                displayName={displayName}
                                draft={draft}
                                error={error}
                                field={activeField}
                                isPending={isPending}
                                onChange={setDraft}
                                onSave={onSave}
                                onSaved={() => setActiveField(null)}
                            />
                        ) : null}
                    </BottomSheet.Content>
                </BottomSheet.Portal>
            </BottomSheet>
        </>
    );
}

function ProfileFieldEditor({
    description,
    descriptionHint,
    displayName,
    draft,
    error,
    field,
    isPending,
    onChange,
    onSave,
    onSaved,
}: {
    description: string;
    descriptionHint: string;
    displayName: string;
    draft: string;
    error: string | null;
    field: ProfileField;
    isPending: boolean;
    onChange: (value: string) => void;
    onSave: (profile: { description: string; displayName: string }) => Promise<unknown>;
    onSaved: () => void;
}) {
    const inputHandlers = useBottomSheetAwareHandlers();
    const isName = field === 'displayName';
    const trimmedDraft = draft.trim();
    const isInvalid = isName && trimmedDraft.length === 0;
    const didChange = trimmedDraft !== (isName ? displayName : description);

    const save = async () => {
        try {
            await onSave({
                description: isName ? description : draft,
                displayName: isName ? draft : displayName,
            });
            onSaved();
        } catch {
            // The mutation error remains visible in this sheet.
        }
    };

    return (
        <View className="gap-5">
            <View className="pr-10">
                <BottomSheet.Title>{isName ? 'Edit name' : 'Edit description'}</BottomSheet.Title>
            </View>
            <TextField isInvalid={isInvalid} isRequired={isName}>
                <Label>{isName ? 'Name' : 'Description'}</Label>
                <Input
                    {...inputHandlers}
                    autoCapitalize={isName ? 'words' : 'sentences'}
                    autoFocus
                    maxLength={isName ? 80 : 500}
                    multiline={!isName}
                    numberOfLines={isName ? 1 : 6}
                    onChangeText={onChange}
                    placeholder={isName ? 'Name' : 'No description yet.'}
                    style={isName ? undefined : { minHeight: 144, textAlignVertical: 'top' }}
                    value={draft}
                    variant="secondary"
                />
                {isName ? <FieldError>Name cannot be blank.</FieldError> : null}
                {isName ? null : <Description>{descriptionHint}</Description>}
            </TextField>
            {error ? <Text className="text-danger text-sm">{error}</Text> : null}
            <Button
                isDisabled={isPending || isInvalid || !didChange}
                onPress={() => void save()}
                variant="primary"
            >
                {isPending ? <Spinner size="sm" /> : null}
                <Button.Label>{isPending ? 'Saving…' : 'Save'}</Button.Label>
            </Button>
        </View>
    );
}
