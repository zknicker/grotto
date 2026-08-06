import type { IconSvgElement } from '@hugeicons/react';
import {
    ChromeIcon,
    CubeIcon,
    File01Icon,
    Folder01Icon,
    Github01Icon,
    Image01Icon,
    MagicWand01Icon,
    PlugIcon,
    UserIcon,
} from '@hugeicons-pro/core-solid-rounded';
import { Globe02Icon } from '@hugeicons-pro/core-stroke-rounded';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';
import { agentColorPresets } from '../agents/agent-color-presets.ts';
import type { ReferenceKind } from './mention-types.ts';

const mentionIconKeys = [
    'agent',
    'chrome',
    'file',
    'folder',
    'github',
    'image',
    'plugin',
    'skill',
    'unknown',
    'user',
    'website',
] as const;

export type MentionIconKey = (typeof mentionIconKeys)[number];

export interface MentionAppearance {
    agentAvatar?: { name: string; src: string | null };
    brandColor?: string;
    icon: MentionIconKey;
    iconDataUrl?: string;
    label?: string;
}

interface MentionAppearanceInput {
    id: string;
    kind: ReferenceKind;
    label: string;
    metadata?: Record<string, unknown>;
}

type MentionAppearanceOverride = Partial<MentionAppearance>;

const defaultMentionAppearance = {
    agent: { icon: 'agent' },
    app: { icon: 'plugin' },
    directory: { icon: 'folder' },
    file: { icon: 'file' },
    image: { icon: 'image' },
    plugin: { icon: 'plugin' },
    skill: { brandColor: 'var(--accent)', icon: 'skill' },
    user: { icon: 'user' },
    website: { icon: 'website' },
} satisfies Record<ReferenceKind, MentionAppearance>;

const skillAppearanceOverrides = {
    'gh-issues': {
        brandColor: 'var(--foreground)',
        icon: 'github',
        label: 'GitHub Issues',
    },
    github: { brandColor: 'var(--foreground)', icon: 'github', label: 'GitHub' },
} satisfies Record<string, MentionAppearanceOverride>;

const capabilityAppearanceOverrides = {
    'computer-use@openai-bundled': {
        icon: 'plugin',
        label: 'Computer Use',
    },
    'computer-use/google-chrome': {
        brandColor: 'var(--success)',
        icon: 'chrome',
        label: 'Chrome',
    },
    'chrome@openai-bundled': {
        brandColor: 'var(--success)',
        icon: 'chrome',
        label: 'Chrome',
    },
    chrome: {
        brandColor: 'var(--success)',
        icon: 'chrome',
        label: 'Chrome',
    },
} satisfies Record<string, MentionAppearanceOverride>;

const mentionIconMap = {
    agent: CubeIcon,
    chrome: ChromeIcon,
    file: File01Icon,
    folder: Folder01Icon,
    github: Github01Icon,
    image: Image01Icon,
    plugin: PlugIcon,
    skill: CubeIcon,
    unknown: MagicWand01Icon,
    user: UserIcon,
    website: Globe02Icon,
} satisfies Record<MentionIconKey, IconSvgElement>;

export function getMentionAppearance(input: MentionAppearanceInput): MentionAppearance {
    const base = defaultMentionAppearance[input.kind];
    const override = getMentionAppearanceOverride(input);

    return {
        ...base,
        ...override,
    };
}

export function MentionAppearanceIcon({
    agentAvatar,
    className,
    iconDataUrl,
    icon,
}: {
    agentAvatar?: MentionAppearance['agentAvatar'];
    className?: string;
    iconDataUrl?: string;
    icon: MentionIconKey;
}) {
    if (agentAvatar) {
        return (
            <EntityAvatar
                className={className}
                name={agentAvatar.name}
                size={16}
                src={agentAvatar.src}
            />
        );
    }

    if (iconDataUrl) {
        return (
            <span className={cn('relative inline-grid', className)}>
                <Icon className="size-full" icon={mentionIconMap[icon]} />
                <span
                    aria-hidden="true"
                    className="absolute inset-0 size-full bg-center bg-contain bg-no-repeat"
                    style={{ backgroundImage: `url("${iconDataUrl.replaceAll('"', '\\"')}")` }}
                />
            </span>
        );
    }

    return <Icon className={className} icon={mentionIconMap[icon]} />;
}

export function getMentionDisplayLabel(input: MentionAppearanceInput) {
    return getMentionAppearance(input).label ?? input.label;
}

// The accent driving a mention chip's tinted badge: the agent's configured
// color, a brand override, or the shared mention accent.
export function getMentionChipColor(appearance: MentionAppearance) {
    if (appearance.agentAvatar) {
        return appearance.brandColor ?? agentColorPresets[0].color;
    }

    return appearance.brandColor ?? 'var(--accent-foreground)';
}

function getMentionAppearanceOverride(input: MentionAppearanceInput) {
    const metadataIconDataUrl = readString(input.metadata?.iconDataUrl);

    if (input.kind === 'agent') {
        return getAgentAvatarOverride(input);
    }

    if ((input.kind === 'app' || input.kind === 'website') && metadataIconDataUrl) {
        return {
            iconDataUrl: metadataIconDataUrl,
        } satisfies MentionAppearanceOverride;
    }

    if (input.kind === 'skill') {
        return getKeyedOverride(skillAppearanceOverrides, input);
    }

    if (input.kind === 'app' || input.kind === 'plugin') {
        return getKeyedOverride(capabilityAppearanceOverrides, input);
    }

    return undefined;
}

// Agent chips carry the agent's avatar (initials when it has no image) tinted
// with its configured color. Appearance rides in mention metadata: composer
// options embed it at pick time (composer chips mount outside app providers)
// and transcript surfaces resolve it live from the agent record before
// rendering.
function getAgentAvatarOverride(input: MentionAppearanceInput) {
    const color = readString(input.metadata?.agentColor);

    return {
        agentAvatar: { name: input.label, src: readString(input.metadata?.agentAvatarUrl) },
        ...(color ? { brandColor: color } : {}),
    } satisfies MentionAppearanceOverride;
}

function getKeyedOverride(
    overrides: Record<string, MentionAppearanceOverride>,
    input: MentionAppearanceInput
) {
    for (const key of getMentionLookupKeys(input)) {
        const override = overrides[key];

        if (override) {
            return override;
        }
    }

    return undefined;
}

function getMentionLookupKeys(input: MentionAppearanceInput) {
    if (input.kind === 'app') {
        return [normalizeLookupKey(input.label)].filter(isPresent);
    }

    return [
        normalizeLookupKey(input.id),
        normalizeLookupKey(input.label),
        normalizeLookupKey(getMentionUriName(input.id)),
    ].filter(isPresent);
}

function getMentionUriName(id: string) {
    const match = id.match(/^(?:app|plugin|skill):\/\/(.+)$/u);
    return match?.[1] ?? null;
}

function normalizeLookupKey(value: string | null) {
    return value?.trim().replace(/^@/u, '').replace(/^\$/u, '').toLowerCase() || null;
}

function isPresent<T>(value: T | null | undefined): value is T {
    return value != null;
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
