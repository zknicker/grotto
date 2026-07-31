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
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';
import { agentColorPresets, resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace, HEAD_KINDS, type HeadName } from '../chats/agent-face.tsx';
import type { MentionOptionKind } from './mention-types.ts';

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
] as const;

export type MentionIconKey = (typeof mentionIconKeys)[number];

export interface MentionAppearance {
    agentFace?: { character: HeadName; color: string | null };
    brandColor?: string;
    icon: MentionIconKey;
    iconDataUrl?: string;
    label?: string;
}

interface MentionAppearanceInput {
    id: string;
    kind: MentionOptionKind;
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
    skill: { brandColor: 'var(--brand)', icon: 'skill' },
    user: { icon: 'user' },
} satisfies Record<MentionOptionKind, MentionAppearance>;

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
        brandColor: 'var(--legacy-success-foreground)',
        icon: 'chrome',
        label: 'Chrome',
    },
    'chrome@openai-bundled': {
        brandColor: 'var(--legacy-success-foreground)',
        icon: 'chrome',
        label: 'Chrome',
    },
    chrome: {
        brandColor: 'var(--legacy-success-foreground)',
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
    agentFace,
    className,
    iconDataUrl,
    icon,
}: {
    agentFace?: MentionAppearance['agentFace'];
    className?: string;
    iconDataUrl?: string;
    icon: MentionIconKey;
}) {
    if (agentFace) {
        // Chips can mount outside app providers (composer editor roots), so
        // theme comes from the document class instead of the theme context.
        const dark = isDocumentDark();

        return (
            <span
                aria-hidden="true"
                // -3% optical lift: the face reads centered against the label
                // cap height (picked from a magnified variant comparison).
                className={cn('flex -translate-y-[3%] items-center justify-center', className)}
            >
                <AgentFace
                    animate={false}
                    dark={dark}
                    head={agentFace.character}
                    ink={resolveAgentInk(dark, agentFace.color)}
                    style={agentFaceIconStyle}
                />
            </span>
        );
    }

    if (iconDataUrl) {
        return (
            <img
                alt=""
                className={className}
                draggable={false}
                height={16}
                src={iconDataUrl}
                width={16}
            />
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
    if (appearance.agentFace) {
        return appearance.agentFace.color ?? agentColorPresets[0].color;
    }

    return appearance.brandColor ?? 'var(--info-foreground)';
}

function getMentionAppearanceOverride(input: MentionAppearanceInput) {
    const metadataIconDataUrl = readString(input.metadata?.iconDataUrl);

    if (input.kind === 'agent') {
        return getAgentFaceOverride(input);
    }

    if (input.kind === 'app' && metadataIconDataUrl) {
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

// Agent chips render the agent's character face tinted with its configured
// color. Appearance rides in mention metadata: composer options embed it at
// pick time (composer chips mount outside app providers) and transcript
// surfaces resolve it live from the agent record before rendering.
function getAgentFaceOverride(input: MentionAppearanceInput) {
    const character = readString(input.metadata?.agentCharacter);
    const color = readString(input.metadata?.agentColor);

    if (!(character && isHeadName(character)) || character === 'none') {
        // No face art, but keep the agent's configured color driving the tint.
        return color ? ({ brandColor: color } satisfies MentionAppearanceOverride) : undefined;
    }

    return {
        agentFace: { character, color },
    } satisfies MentionAppearanceOverride;
}

function isHeadName(value: string): value is HeadName {
    return (HEAD_KINDS as readonly string[]).includes(value);
}

const agentFaceIconStyle = {
    display: 'block',
    height: '100%',
    overflow: 'visible',
    width: '100%',
} as const;

function isDocumentDark() {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
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
