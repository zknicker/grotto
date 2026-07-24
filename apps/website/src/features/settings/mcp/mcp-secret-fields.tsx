import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
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
                    <Input
                        aria-label={`${title} name`}
                        className="max-w-44"
                        onChange={(event) =>
                            onChange(
                                replaceEntryAt(entries, index, {
                                    ...entry,
                                    name: event.target.value,
                                })
                            )
                        }
                        placeholder="Name"
                        type="text"
                        value={entry.name}
                    />
                    <Input
                        aria-label={`${title} value`}
                        onChange={(event) =>
                            onChange(
                                replaceEntryAt(entries, index, {
                                    ...entry,
                                    value: event.target.value,
                                })
                            )
                        }
                        placeholder="Value"
                        type="password"
                        value={entry.value}
                    />
                    <Button
                        aria-label={`Remove ${title.toLowerCase()} entry`}
                        onClick={() => onChange(entries.filter((_, at) => at !== index))}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                    >
                        <Icon icon={Cancel01Icon} />
                    </Button>
                </div>
            ))}
            <Button
                className="justify-self-start"
                onClick={() => onChange([...entries, createSecretDraftEntry()])}
                type="button"
                variant="outline"
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
