import { Button, Input, Popover, TextArea, TextField } from '@heroui/react';
import * as React from 'react';

/**
 * One labeled Edit Profile action for the whole identity. Name and
 * description used to carry an icon pencil each, which read as orphaned
 * chrome; the identity mutation saves both fields together anyway, so one
 * editor matches the contract instead of splitting it.
 */
export function ProfileEdit({
    description,
    displayName,
    entityLabel,
    isDisabled,
    namePlaceholder,
    onSave,
}: {
    description: string;
    displayName: string;
    entityLabel: string;
    isDisabled?: boolean;
    namePlaceholder: string;
    onSave: (draft: { description: string; displayName: string }) => Promise<void>;
}) {
    const [nameDraft, setNameDraft] = React.useState(displayName);
    const [descriptionDraft, setDescriptionDraft] = React.useState(description);
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        if (!open) {
            setNameDraft(displayName);
            setDescriptionDraft(description);
        }
    }, [description, displayName, open]);

    const changed = nameDraft !== displayName || descriptionDraft !== description;
    const canSave = changed && nameDraft.trim().length > 0 && !isDisabled;

    const save = async () => {
        if (!canSave) {
            return;
        }

        try {
            await onSave({ description: descriptionDraft, displayName: nameDraft });
            setOpen(false);
        } catch {
            // The mutation owns the error toast; keep the editor open for retry.
        }
    };

    return (
        <Popover isOpen={open} onOpenChange={setOpen}>
            <Button isDisabled={isDisabled} size="sm" variant="secondary">
                Edit Profile
            </Button>
            <Popover.Content className="w-80" placement="bottom">
                <Popover.Dialog className="grid gap-3 p-3">
                    <Popover.Heading>{entityLabel}</Popover.Heading>
                    <TextField
                        aria-label="Name"
                        fullWidth
                        onChange={setNameDraft}
                        value={nameDraft}
                        variant="secondary"
                    >
                        <Input
                            autoFocus
                            fullWidth
                            maxLength={80}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void save();
                                }
                            }}
                            placeholder={namePlaceholder}
                        />
                    </TextField>
                    <TextField
                        aria-label="Description"
                        fullWidth
                        onChange={setDescriptionDraft}
                        value={descriptionDraft}
                        variant="secondary"
                    >
                        <TextArea maxLength={500} placeholder="No description yet." rows={3} />
                    </TextField>
                    <div className="flex justify-end gap-2">
                        <Button onPress={() => setOpen(false)} size="sm" variant="ghost">
                            Cancel
                        </Button>
                        <Button
                            isDisabled={!canSave}
                            isPending={isDisabled}
                            onPress={() => void save()}
                            size="sm"
                        >
                            Save
                        </Button>
                    </div>
                </Popover.Dialog>
            </Popover.Content>
        </Popover>
    );
}
