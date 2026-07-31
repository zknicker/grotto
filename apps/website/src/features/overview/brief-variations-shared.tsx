import type { IconSvgElement } from '@hugeicons/react';
import type { ReactNode } from 'react';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace } from '../chats/agent-face.tsx';
import type { OverviewAgent } from './overview-types.ts';

export type Agent = OverviewAgent;

// Dominant art color per character head (sampled from the face art fills in
// agent-face.tsx) so a mentioned agent's name reads as the same "ink" as its
// avatar. primaryColor is a slate default when unset, so art wins.
const headAccentColors: Record<string, string> = {
    alien: '#a1d433',
    bird: '#0265e3',
    knight: '#4e3e84',
    owl: '#573aa5',
    robot: '#04abc5',
};

/** Chip text color for an agent mention — art accent mixed for text duty. */
export function resolveAgentBriefColor(dark: boolean, agent: Agent): string | undefined {
    const color = headAccentColors[agent.effectiveCharacter] ?? agent.effectivePrimaryColor;

    if (!color) {
        return;
    }

    return `color-mix(in srgb, ${color} ${dark ? '65%, white' : '82%, black'})`;
}

/** The inline wordmark. Reel runs narrow at high HGHT, so this backs the
 *  axis off, sizes up, and letter-tracks to fight the squish. The right
 *  margin trims Reel's wide trailing bearing plus the tracking's phantom
 *  space after the final glyph. Brand purple is lifted toward white on dark
 *  ground where the raw token dies. */
export function GrottoMark() {
    const dark = useResolvedThemeOptional() === 'dark';

    return (
        <span
            className="whitespace-nowrap not-italic leading-none"
            style={{
                color: dark ? 'color-mix(in srgb, var(--brand) 52%, white)' : 'var(--brand)',
                fontFamily: "'Reel Variable', var(--font-heading)",
                fontSize: '1.5em',
                fontVariationSettings: "'HGHT' 46, 'wght' 600",
                letterSpacing: '0.035em',
                marginRight: '-0.08em',
            }}
        >
            Grotto
        </span>
    );
}

export interface VariationProps {
    agents: Agent[];
    dark: boolean;
}

export function VariationSection({
    children,
    eyebrow,
    note,
}: {
    children: ReactNode;
    eyebrow: string;
    note: string;
}) {
    return (
        <section className="border-border border-t pt-6 first:border-t-0 first:pt-0">
            <div className="font-mono text-caption text-muted-foreground uppercase tracking-widest">
                {eyebrow}
            </div>
            <p className="mt-1 max-w-[60ch] text-muted-foreground text-sm">{note}</p>
            <div className="mt-8">{children}</div>
        </section>
    );
}

const chipTones = {
    amber: 'text-(--label-amber-fg)',
    blue: 'text-info-foreground',
    green: 'text-legacy-success-foreground',
    orange: 'text-(--label-orange-fg)',
    pink: 'text-(--label-pink-fg)',
    purple: 'text-brand-muted-foreground',
    red: 'text-(--label-red-fg)',
} as const;

export type ChipTone = keyof typeof chipTones;

/** Data chip: bold colored text with a same-color icon. No backgrounds. */
export function Chip({
    children,
    icon,
    tone,
}: {
    children: ReactNode;
    icon: IconSvgElement;
    tone: ChipTone;
}) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap align-[-0.1em] font-semibold not-italic ${chipTones[tone]}`}
        >
            <Icon aria-hidden="true" className="size-[0.8em] shrink-0" icon={icon} />
            {children}
        </span>
    );
}

/** Agent chip: the face is the icon, and the bold name takes the face art's
 *  own color so it obeys the same contract as every other chip. */
export function AgentChip({
    agents,
    dark,
    fallback,
    id,
}: {
    agents: Agent[];
    dark: boolean;
    fallback: string;
    id: string;
}) {
    const agent =
        agents.find((entry) => entry.id === id) ??
        agents.find((entry) => entry.name.toLowerCase() === fallback.toLowerCase());

    if (!agent) {
        return <span className="font-semibold text-foreground not-italic">{fallback}</span>;
    }

    return (
        <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap align-[-0.12em] font-semibold not-italic"
            style={{ color: resolveAgentBriefColor(dark, agent) }}
        >
            <span aria-hidden="true" className="inline-flex size-7 items-center">
                <AgentFace
                    animate={false}
                    dark={dark}
                    head={agent.effectiveCharacter}
                    ink={resolveAgentInk(dark, agent.effectivePrimaryColor)}
                    size={30}
                />
            </span>
            {agent.name}
        </span>
    );
}
