import { Button, Input, Tooltip } from '@heroui/react';
import { EyeIcon, EyeOff } from '@hugeicons-pro/core-stroke-rounded';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useState } from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { BrowserField, BrowserFieldRow } from './browser-dialog.tsx';

export interface BrowserConfigField<TDraft> {
    ariaLabel: string;
    description?: ReactNode;
    error?: ReactNode;
    id: string;
    kind: 'secret' | 'text';
    label: ReactNode;
    monospace?: boolean;
    name?: string;
    placeholder?: string;
    read: (draft: TDraft) => string;
    write: (draft: TDraft, value: string) => TDraft;
}

export function BrowserConfigFields<TDraft>({
    disabled,
    draft,
    fields,
    onDraftChange,
}: {
    disabled: boolean;
    draft: TDraft;
    fields: readonly BrowserConfigField<TDraft>[];
    onDraftChange: Dispatch<SetStateAction<TDraft>>;
}) {
    const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

    return (
        <>
            {fields.map((field) => (
                <BrowserField
                    description={field.description}
                    error={field.error}
                    key={field.id}
                    label={field.label}
                >
                    {field.kind === 'secret' ? (
                        <div className="flex min-w-0 items-center gap-2 font-mono">
                            <div className="min-w-0 flex-1">
                                <Input
                                    aria-label={field.ariaLabel}
                                    autoComplete="off"
                                    disabled={disabled}
                                    fullWidth
                                    name={field.name ?? field.id}
                                    onChange={(event) =>
                                        onDraftChange((current) =>
                                            field.write(current, event.currentTarget.value)
                                        )
                                    }
                                    placeholder={field.placeholder}
                                    spellCheck={false}
                                    type={revealedSecrets[field.id] ? 'text' : 'password'}
                                    value={field.read(draft)}
                                />
                            </div>
                            <Tooltip delay={0}>
                                <Button
                                    aria-label={
                                        revealedSecrets[field.id]
                                            ? `Hide ${field.ariaLabel}`
                                            : `Reveal ${field.ariaLabel}`
                                    }
                                    isDisabled={disabled || field.read(draft).length === 0}
                                    isIconOnly
                                    onPress={() =>
                                        setRevealedSecrets((current) => ({
                                            ...current,
                                            [field.id]: !current[field.id],
                                        }))
                                    }
                                    size="sm"
                                    variant="ghost"
                                >
                                    <Icon icon={revealedSecrets[field.id] ? EyeOff : EyeIcon} />
                                </Button>
                                <Tooltip.Content placement="top">
                                    {revealedSecrets[field.id]
                                        ? `Hide ${field.ariaLabel}`
                                        : `Reveal ${field.ariaLabel}`}
                                </Tooltip.Content>
                            </Tooltip>
                        </div>
                    ) : (
                        <div className={field.monospace ? 'font-mono' : undefined}>
                            <Input
                                aria-label={field.ariaLabel}
                                autoComplete="off"
                                disabled={disabled}
                                fullWidth
                                onChange={(event) =>
                                    onDraftChange((current) =>
                                        field.write(current, event.currentTarget.value)
                                    )
                                }
                                placeholder={field.placeholder}
                                value={field.read(draft)}
                            />
                        </div>
                    )}
                </BrowserField>
            ))}
        </>
    );
}

export function BrowserConfigFieldRow<TDraft>({
    disabled,
    draft,
    fields,
    onDraftChange,
}: {
    disabled: boolean;
    draft: TDraft;
    fields: readonly BrowserConfigField<TDraft>[];
    onDraftChange: Dispatch<SetStateAction<TDraft>>;
}) {
    return (
        <BrowserFieldRow>
            <BrowserConfigFields
                disabled={disabled}
                draft={draft}
                fields={fields}
                onDraftChange={onDraftChange}
            />
        </BrowserFieldRow>
    );
}
