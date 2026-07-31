'use client';

import { Combobox } from '@base-ui/react/combobox';
import { Close } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Elevated } from '../../components/ui/surface.tsx';
import { cn } from '../../lib/utils.ts';

interface AllowedToolsInputProps {
    id?: string;
    onChange: (value: string) => void;
    value: string;
}

interface ToolOption {
    isCustom?: boolean;
    label: string;
    value: string;
}

const SUGGESTED_TOOLS = [
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'Bash',
    'Bash(*)',
    'WebSearch',
    'WebFetch',
    'Task',
    'Skill',
].map((value) => ({
    label: value,
    value,
}));

function dedupeToolValues(values: string[]) {
    const seen = new Set<string>();

    return values.filter((value) => {
        if (seen.has(value)) {
            return false;
        }

        seen.add(value);
        return true;
    });
}

function normalizeToolValue(value: string) {
    return value.trim().replaceAll(/^,+|,+$/g, '');
}

function parseAllowedToolsValue(input: string) {
    return dedupeToolValues(
        input
            .split(/[\s,]+/g)
            .map(normalizeToolValue)
            .filter((value) => value.length > 0)
    );
}

function serializeAllowedToolsValue(values: string[]) {
    return dedupeToolValues(
        values.map(normalizeToolValue).filter((value) => value.length > 0)
    ).join(' ');
}

export function AllowedToolsInput({
    id,
    onChange,
    value,
}: AllowedToolsInputProps): React.ReactElement {
    const [inputValue, setInputValue] = React.useState('');
    const selectedValues = React.useMemo(() => parseAllowedToolsValue(value), [value]);
    const currentSerializedValue = React.useMemo(
        () => serializeAllowedToolsValue(selectedValues),
        [selectedValues]
    );
    const undoStackRef = React.useRef<string[]>([]);
    const pendingCommittedValueRef = React.useRef<null | string>(null);
    const selectedSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);
    const knownSuggestionSet = React.useMemo(
        () => new Set(SUGGESTED_TOOLS.map((tool) => tool.value)),
        []
    );
    const selectedOptions = React.useMemo(
        () =>
            selectedValues.map((toolValue) => ({
                isCustom: !knownSuggestionSet.has(toolValue),
                label: toolValue,
                value: toolValue,
            })),
        [knownSuggestionSet, selectedValues]
    );
    const normalizedInputValue = normalizeToolValue(inputValue);
    const filteredSuggestions = React.useMemo(() => {
        const searchTerm = normalizedInputValue.toLowerCase();

        return SUGGESTED_TOOLS.filter((tool) => {
            if (selectedSet.has(tool.value)) {
                return false;
            }

            if (searchTerm.length === 0) {
                return true;
            }

            return tool.value.toLowerCase().includes(searchTerm);
        });
    }, [normalizedInputValue, selectedSet]);
    const customSuggestion =
        normalizedInputValue.length > 0 &&
        !selectedSet.has(normalizedInputValue) &&
        !knownSuggestionSet.has(normalizedInputValue)
            ? {
                  isCustom: true,
                  label: normalizedInputValue,
                  value: normalizedInputValue,
              }
            : null;
    const items = React.useMemo(
        () => (customSuggestion ? [customSuggestion, ...filteredSuggestions] : filteredSuggestions),
        [customSuggestion, filteredSuggestions]
    );
    React.useEffect(() => {
        if (pendingCommittedValueRef.current === currentSerializedValue) {
            pendingCommittedValueRef.current = null;
            return;
        }

        undoStackRef.current = [];
    }, [currentSerializedValue]);
    const commitValue = React.useEffectEvent(
        (nextValues: string[], options?: { recordUndo?: boolean }) => {
            const nextSerializedValue = serializeAllowedToolsValue(nextValues);

            if (nextSerializedValue === currentSerializedValue) {
                return;
            }

            if (options?.recordUndo !== false) {
                const previousValue = currentSerializedValue;
                const lastUndoValue = undoStackRef.current.at(-1);

                if (lastUndoValue !== previousValue) {
                    undoStackRef.current.push(previousValue);

                    if (undoStackRef.current.length > 20) {
                        undoStackRef.current.shift();
                    }
                }
            }

            pendingCommittedValueRef.current = nextSerializedValue;
            onChange(nextSerializedValue);
        }
    );
    const undoLastChange = React.useEffectEvent(() => {
        const previousValue = undoStackRef.current.pop();

        if (previousValue === undefined) {
            return false;
        }

        pendingCommittedValueRef.current = previousValue;
        onChange(previousValue);
        setInputValue('');
        return true;
    });
    const addPendingCustomTool = React.useEffectEvent(() => {
        if (!customSuggestion) {
            return false;
        }

        commitValue([...selectedValues, customSuggestion.value]);
        setInputValue('');
        return true;
    });

    return (
        <Combobox.Root
            autoHighlight
            id={id}
            isItemEqualToValue={(item, selected) => item.value === selected.value}
            items={items}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.value}
            multiple
            onInputValueChange={setInputValue}
            onValueChange={(nextValues) => {
                commitValue(nextValues.map((item) => item.value));
                setInputValue('');
            }}
            value={selectedOptions}
        >
            <Combobox.Chips
                className={cn(
                    'relative flex min-h-10 w-full flex-wrap items-center gap-2 rounded-lg border border-input bg-background px-2 py-2 text-sm ring-ring/24 focus-within:border-ring focus-within:ring-[3px]',
                    'aria-invalid:border-destructive/36 aria-invalid:focus-within:border-destructive/64 aria-invalid:focus-within:ring-destructive/16 dark:aria-invalid:focus-within:ring-destructive/24'
                )}
            >
                <Combobox.Value>
                    {(selected: ToolOption[]) => (
                        <>
                            {selected.map((item) => (
                                <Combobox.Chip
                                    aria-label={item.label}
                                    className="inline-flex h-7 items-center gap-1 rounded-md bg-legacy-muted px-2.5 text-foreground text-sm"
                                    key={item.value}
                                >
                                    <span className="max-w-48 truncate">{item.label}</span>
                                    <Combobox.ChipRemove
                                        aria-label={`Remove ${item.label}`}
                                        className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
                                    >
                                        <Icon className="size-3.5" icon={Close} />
                                    </Combobox.ChipRemove>
                                </Combobox.Chip>
                            ))}
                            <Combobox.Input
                                className="min-w-28 flex-1 bg-transparent px-1 py-0.5 text-foreground text-sm outline-none placeholder:text-muted-foreground/72"
                                onKeyDown={(event) => {
                                    if (
                                        (event.metaKey || event.ctrlKey) &&
                                        !event.altKey &&
                                        !event.shiftKey &&
                                        event.key.toLowerCase() === 'z' &&
                                        inputValue.length === 0
                                    ) {
                                        const undone = undoLastChange();

                                        if (undone) {
                                            event.preventDefault();
                                        }

                                        return;
                                    }

                                    if (event.key === ',' || event.key === 'Tab') {
                                        const added = addPendingCustomTool();

                                        if (added) {
                                            event.preventDefault();
                                        }
                                    }

                                    if (
                                        event.key === 'Enter' &&
                                        customSuggestion &&
                                        filteredSuggestions.length === 0
                                    ) {
                                        const added = addPendingCustomTool();

                                        if (added) {
                                            event.preventDefault();
                                        }
                                    }
                                }}
                                placeholder={
                                    selected.length > 0
                                        ? undefined
                                        : 'Select tools or type a custom token'
                                }
                            />
                        </>
                    )}
                </Combobox.Value>
            </Combobox.Chips>
            <Combobox.Portal>
                <Combobox.Positioner align="start" className="z-50" side="bottom" sideOffset={6}>
                    <Combobox.Popup className="min-w-[min(var(--anchor-width),28rem)] origin-(--transform-origin) outline-none">
                        <Elevated className="overflow-hidden rounded-lg" offset={2} shadowLevel={3}>
                            {items.length === 0 ? (
                                <Combobox.Empty className="px-3 py-2 text-muted-foreground text-sm">
                                    No tools found.
                                </Combobox.Empty>
                            ) : null}
                            <Combobox.List className="max-h-64 overflow-y-auto p-1.5">
                                {(item: ToolOption) => (
                                    <Combobox.Item
                                        className="flex cursor-default items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm outline-none data-highlighted:bg-legacy-accent data-highlighted:text-legacy-accent-foreground"
                                        key={item.value}
                                        value={item}
                                    >
                                        <span className="truncate">{item.label}</span>
                                        {item.isCustom ? (
                                            <span className="shrink-0 text-caption text-muted-foreground uppercase tracking-[0.16em]">
                                                Custom
                                            </span>
                                        ) : null}
                                    </Combobox.Item>
                                )}
                            </Combobox.List>
                        </Elevated>
                    </Combobox.Popup>
                </Combobox.Positioner>
            </Combobox.Portal>
        </Combobox.Root>
    );
}
