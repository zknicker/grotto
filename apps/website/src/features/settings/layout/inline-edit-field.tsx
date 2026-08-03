import { Input, TextArea, TextField } from '@heroui/react';
import * as React from 'react';

export interface InlineEditFieldProps {
    ariaLabel: string;
    isDisabled?: boolean;
    /** Blanking a required field restores the saved text instead of saving. */
    isRequired?: boolean;
    maxLength?: number;
    multiline?: boolean;
    /** Runs only when the committed text differs from `value`. */
    onCommit: (value: string) => Promise<void>;
    placeholder?: string;
    value: string;
}

/**
 * A settings value that is edited in place: the field is always live, the
 * draft commits on blur (or Enter on one line), and Escape restores the saved
 * text. Callers own persistence and its feedback.
 */
export function InlineEditField({
    ariaLabel,
    isDisabled,
    isRequired = false,
    maxLength,
    multiline = false,
    onCommit,
    placeholder,
    value,
}: InlineEditFieldProps): React.ReactElement {
    const [draft, setDraft] = React.useState(value);
    const editingRef = React.useRef(false);
    // Escape blurs to leave the field, and that blur must not save the text it
    // just threw away.
    const revertingRef = React.useRef(false);

    // A save (or someone else's edit) replaces the saved text; adopt it unless
    // the field is mid-edit, which would yank the cursor out from under a typist.
    React.useEffect(() => {
        if (!editingRef.current) {
            setDraft(value);
        }
    }, [value]);

    const commit = async (committed: string) => {
        editingRef.current = false;

        if (revertingRef.current) {
            revertingRef.current = false;
            setDraft(value);
            return;
        }

        if (committed === value || (isRequired && committed.trim().length === 0)) {
            setDraft(value);
            return;
        }

        try {
            await onCommit(committed);
        } catch {
            setDraft(value);
        }
    };

    // Key handling lives on the input itself: `currentTarget` has to be the
    // real field for blur() to end the edit.
    const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
            revertingRef.current = true;
            setDraft(value);
            (event.currentTarget as HTMLElement).blur();
            return;
        }

        if (event.key === 'Enter' && !multiline) {
            event.preventDefault();
            (event.currentTarget as HTMLElement).blur();
        }
    };

    return (
        <TextField
            aria-label={ariaLabel}
            fullWidth
            isDisabled={isDisabled}
            onBlur={() => void commit(draft)}
            onChange={setDraft}
            onFocus={() => {
                editingRef.current = true;
            }}
            value={draft}
            variant="secondary"
        >
            {multiline ? (
                <TextArea
                    maxLength={maxLength}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    rows={3}
                />
            ) : (
                <Input
                    fullWidth
                    maxLength={maxLength}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                />
            )}
        </TextField>
    );
}
