import { Button, Input, Popover, TextArea, TextField, Tooltip } from '@heroui/react';
import { Edit02Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';

export function ProfileEdit({
    ariaLabel,
    isDisabled,
    isRequired = false,
    maxLength,
    multiline = false,
    onSave,
    placeholder,
    value,
}: {
    ariaLabel: string;
    isDisabled?: boolean;
    isRequired?: boolean;
    maxLength?: number;
    multiline?: boolean;
    onSave: (value: string) => Promise<void>;
    placeholder?: string;
    value: string;
}) {
    const [draft, setDraft] = React.useState(value);
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        if (!open) {
            setDraft(value);
        }
    }, [open, value]);

    const canSave = draft !== value && (!isRequired || draft.trim().length > 0) && !isDisabled;

    const save = async () => {
        if (!canSave) {
            return;
        }

        try {
            await onSave(draft);
            setOpen(false);
        } catch {
            // The mutation owns the error toast; keep the editor open for retry.
        }
    };

    return (
        <Popover isOpen={open} onOpenChange={setOpen}>
            <Tooltip delay={0} isDisabled={open}>
                <Button
                    aria-label={`Edit ${ariaLabel.toLowerCase()}`}
                    isDisabled={isDisabled}
                    isIconOnly
                    size="sm"
                    variant="ghost"
                >
                    <Icon aria-hidden="true" className="size-4" icon={Edit02Icon} />
                </Button>
                <Tooltip.Content>Edit {ariaLabel.toLowerCase()}</Tooltip.Content>
            </Tooltip>
            <Popover.Content className={multiline ? 'w-80' : 'w-64'} placement="bottom">
                <Popover.Dialog className="grid gap-3 p-3">
                    <Popover.Heading>{ariaLabel}</Popover.Heading>
                    <TextField
                        aria-label={ariaLabel}
                        fullWidth
                        onChange={setDraft}
                        value={draft}
                        variant="secondary"
                    >
                        {multiline ? (
                            <TextArea
                                autoFocus
                                maxLength={maxLength}
                                placeholder={placeholder}
                                rows={3}
                            />
                        ) : (
                            <Input
                                autoFocus
                                fullWidth
                                maxLength={maxLength}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void save();
                                    }
                                }}
                                placeholder={placeholder}
                            />
                        )}
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
