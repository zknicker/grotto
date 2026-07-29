import {
    type AgentCharacter,
    agentCharacterLabels,
    agentCharacters,
} from '@tavern/api/agent-appearance';
import { useEffect, useState } from 'react';
import { useResolvedThemeOptional } from '../../../components/theme-provider.tsx';
import {
    Popover,
    PopoverClose,
    PopoverContent,
    PopoverTrigger,
} from '../../../components/ui/popover.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectTriggerIcon,
    SelectValue,
    selectTriggerVariants,
} from '../../../components/ui/select.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { Textarea } from '../../../components/ui/textarea.tsx';
import { nextSessionNote, withSavingToast } from '../../../lib/saving-toast.ts';
import { type AgentListOutput, trpc } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import { agentColorPresets, resolveAgentInk } from '../../agents/agent-color-presets.ts';
import { useAgentProfileUpdate } from '../../agents/use-agent-profile-update.ts';
import { AgentFace } from '../../chats/agent-face.tsx';

const faceStyle = { flexShrink: 0, overflow: 'visible' } as const;

export function AgentIdentitySection({
    agent,
    disabled,
}: {
    agent: AgentListOutput['agents'][number];
    disabled: boolean;
}) {
    const utils = trpc.useUtils();
    const saveAgentProfile = useAgentProfileUpdate();
    const invalidateAgents = async () => {
        await Promise.all([utils.agent.list.invalidate(), utils.agent.primary.invalidate()]);
    };
    const updateName = trpc.agent.updateName.useMutation({ onSuccess: invalidateAgents });
    const updateBio = trpc.agent.updateBio.useMutation({ onSuccess: invalidateAgents });
    const [displayName, setDisplayName] = useState(agent.name);
    const [bio, setBio] = useState(agent.bio ?? '');
    const isSaving = disabled || updateName.isPending;
    const isSavingBio = disabled || updateBio.isPending;

    useEffect(() => {
        setDisplayName(agent.name);
    }, [agent.name]);

    useEffect(() => {
        setBio(agent.bio ?? '');
    }, [agent.bio]);

    const selectedColor = agent.effectivePrimaryColor;
    const selectedColorPreset =
        agentColorPresets.find(
            (preset) => preset.color.toLowerCase() === selectedColor.toLowerCase()
        ) ?? null;

    return (
        <SettingsSection title="Identity">
            <SettingsGroup>
                <SettingsRow title="Display name">
                    <Input
                        disabled={isSaving}
                        id="agent-display-name"
                        name="agent-display-name"
                        onBlur={() => {
                            const nextName = displayName.trim() || agent.id;

                            if (nextName === agent.name) {
                                return;
                            }

                            void withSavingToast(
                                () =>
                                    updateName.mutateAsync({
                                        agentId: agent.id,
                                        name: nextName,
                                    }),
                                { successNote: nextSessionNote }
                            ).catch(() => undefined);
                        }}
                        onChange={(event) => {
                            setDisplayName(event.target.value);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.currentTarget.blur();
                            }
                        }}
                        placeholder={agent.id}
                        value={displayName}
                    />
                </SettingsRow>

                <Separator />

                <SettingsRow
                    description="A short job description. Agents sharing a chat see each other's bios."
                    title="Description"
                >
                    <Textarea
                        disabled={isSavingBio}
                        id="agent-bio"
                        maxLength={280}
                        name="agent-bio"
                        onBlur={() => {
                            const nextBio = bio.trim() || null;

                            if (nextBio === (agent.bio ?? null)) {
                                return;
                            }

                            void withSavingToast(
                                () =>
                                    updateBio.mutateAsync({
                                        agentId: agent.id,
                                        bio: nextBio,
                                    }),
                                { successNote: nextSessionNote }
                            ).catch(() => undefined);
                        }}
                        onChange={(event) => {
                            setBio(event.target.value);
                        }}
                        placeholder="e.g. Runs the Amazon Merch business: sales, listings, and research."
                        rows={2}
                        value={bio}
                    />
                </SettingsRow>

                <Separator />

                <SettingsRow title="Color">
                    <Select
                        disabled={saveAgentProfile.isPending}
                        onValueChange={(color) => {
                            if (!color) {
                                return;
                            }

                            saveAgentProfile.mutate({
                                agentId: agent.id,
                                primaryColor:
                                    color.toLowerCase() === agent.defaultPrimaryColor.toLowerCase()
                                        ? null
                                        : color,
                            });
                        }}
                        value={selectedColor.toLowerCase()}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Choose color">
                                <AgentColorOption
                                    color={selectedColor}
                                    label={selectedColorPreset?.label ?? selectedColor}
                                />
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {agentColorPresets.map((preset) => (
                                <SelectItem key={preset.color} value={preset.color}>
                                    <AgentColorOption color={preset.color} label={preset.label} />
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SettingsRow>

                <Separator />

                <SettingsRow title="Character">
                    <AgentCharacterPicker
                        disabled={saveAgentProfile.isPending}
                        onSelect={(character) =>
                            saveAgentProfile.mutate({
                                agentId: agent.id,
                                character: character === agent.defaultCharacter ? null : character,
                            })
                        }
                        primaryColor={agent.effectivePrimaryColor}
                        selected={agent.effectiveCharacter}
                    />
                </SettingsRow>
            </SettingsGroup>
        </SettingsSection>
    );
}

function AgentCharacterPicker({
    disabled,
    onSelect,
    primaryColor,
    selected,
}: {
    disabled: boolean;
    onSelect: (character: AgentCharacter) => void;
    primaryColor: string;
    selected: AgentCharacter;
}) {
    const dark = useResolvedThemeOptional() === 'dark';
    const ink = resolveAgentInk(dark, primaryColor);

    return (
        <Popover>
            <PopoverTrigger className={selectTriggerVariants()} disabled={disabled}>
                <span className="flex min-w-0 flex-1 items-center truncate">
                    <AgentCharacterOption character={selected} dark={dark} ink={ink} />
                </span>
                <SelectTriggerIcon />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72">
                <div className="grid grid-cols-4 gap-2">
                    {agentCharacters.map((character) => {
                        const isSelected = character === selected;

                        return (
                            <PopoverClose
                                aria-label={agentCharacterLabels[character]}
                                aria-pressed={isSelected}
                                className={cn(
                                    'flex aspect-square items-center justify-center rounded-xl border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                                    isSelected
                                        ? 'border-brand bg-active'
                                        : 'border-transparent bg-muted hover:bg-hover'
                                )}
                                key={character}
                                onClick={() => onSelect(character)}
                                title={agentCharacterLabels[character]}
                            >
                                <AgentFace
                                    animate={false}
                                    dark={dark}
                                    head={character}
                                    ink={ink}
                                    size={40}
                                    style={faceStyle}
                                />
                            </PopoverClose>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function AgentCharacterOption({
    character,
    dark,
    ink,
}: {
    character: AgentCharacter;
    dark: boolean;
    ink: string | undefined;
}) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <AgentFace
                animate={false}
                dark={dark}
                head={character}
                ink={ink}
                size={20}
                style={faceStyle}
            />
            <span className="truncate">{agentCharacterLabels[character]}</span>
        </span>
    );
}

function AgentColorOption({ color, label }: { color: string; label: string }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="truncate">{label}</span>
        </span>
    );
}
