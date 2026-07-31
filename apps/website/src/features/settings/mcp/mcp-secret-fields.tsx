import { Button, Input, TextField, Tooltip } from '@heroui/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../../components/ui/icon.tsx';
import { createSecretDraftEntry, type SecretDraftEntry } from './mcp-server-shared.ts';

export function SecretFieldsEditor({
    addLabel,
    entries,
    onChange,
    title,
}: {
    addLabel: string;
    entries: SecretDraftEntry[];
    onChange: (next: SecretDraftEntry[]) => void;
    title: string;
}) {
    return (
        <div className="grid gap-2">
            <span className="font-medium text-foreground text-sm">{title}</span>
            {entries.map((entry, index) => (
                <div className="flex items-center gap-2" key={entry.key}>
                    <TextField
                        aria-label={`${title} name`}
                        onChange={(value) =>
                            onChange(
                                replaceEntryAt(entries, index, {
                                    ...entry,
                                    name: value,
                                })
                            )
                        }
                        value={entry.name}
                        variant="secondary"
                    >
                        <Input placeholder="Name" />
                    </TextField>
                    <TextField
                        aria-label={`${title} value`}
                        onChange={(value) =>
                            onChange(
                                replaceEntryAt(entries, index, {
                                    ...entry,
                                    value,
                                })
                            )
                        }
                        type="password"
                        value={entry.value}
                        variant="secondary"
                    >
                        <Input placeholder="Value" />
                    </TextField>
                    <Tooltip delay={0}>
                        <Button
                            aria-label={`Remove ${title.toLowerCase()} entry`}
                            isIconOnly
                            onPress={() => onChange(entries.filter((_, at) => at !== index))}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            <Icon icon={Cancel01Icon} />
                        </Button>
                        <Tooltip.Content placement="top">Remove Entry</Tooltip.Content>
                    </Tooltip>
                </div>
            ))}
            <Button
                onPress={() => onChange([...entries, createSecretDraftEntry()])}
                size="sm"
                type="button"
                variant="secondary"
            >
                {addLabel}
            </Button>
        </div>
    );
}

function replaceEntryAt(
    entries: SecretDraftEntry[],
    index: number,
    next: SecretDraftEntry
): SecretDraftEntry[] {
    return entries.map((entry, at) => (at === index ? next : entry));
}
