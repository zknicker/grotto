import type { IconSvgElement } from '@hugeicons/react';
import {
    AmazonIcon,
    BirthdayCakeIcon,
    Calendar03Icon,
    CheckListIcon,
    Clock01Icon,
    CloudAngledRainIcon,
    DollarCircleIcon,
    FireworksIcon,
    GiftIcon,
    Joystick04Icon,
    Megaphone01Icon,
    Message01Icon,
    Moon02Icon,
    PumpkinIcon,
    ShoppingBasket02Icon,
    Store01Icon,
    Sun01Icon,
} from '@hugeicons-pro/core-solid-rounded';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { KimiPatterns } from './brief-variations-kimi.tsx';
import { OccasionVariations } from './brief-variations-occasions.tsx';
import {
    AgentChip,
    Chip,
    type ChipTone,
    GrottoMark,
    type VariationProps,
    VariationSection,
} from './brief-variations-shared.tsx';

// Dev hack page (/design/brief): candidate treatments for the home brief,
// rendered side by side against tonight's sample data so taste calls can be
// made on real pixels. The base voice is settled (italic muted grey, chips
// shine); what varies now is sentence structure and the wordmark cut. The
// winner gets folded back into the OverviewBriefSegment renderer.
export function BriefVariations() {
    const agents = useAgentList().data?.agents ?? [];

    return <BriefVariationsView agents={agents} />;
}

export function BriefVariationsView({ agents }: { agents: VariationProps['agents'] }) {
    const dark = useResolvedThemeOptional() === 'dark';

    return (
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
            <div className="w-full max-w-4xl px-10 pt-8 pb-24">
                <h1 className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
                    Brief variations
                </h1>

                <div className="mt-10 flex flex-col gap-12">
                    <VariationSection
                        eyebrow="A1 — Scene first"
                        note="The wordmark lands in the opening clause; connective prose stretches out so every chip gets air."
                    >
                        <SceneFirst agents={agents} dark={dark} />
                    </VariationSection>

                    <VariationSection
                        eyebrow="A2 — Day with a shape"
                        note="A day in the Grotto as a place, on a clock: morning, afternoon, moonrise. Sources named."
                    >
                        <DayWithAShape agents={agents} dark={dark} />
                    </VariationSection>

                    <VariationSection
                        eyebrow="A3 — The quiet one"
                        note="Fewer chips, more prose — the floor of the system for slow days."
                    >
                        <QuietOne agents={agents} dark={dark} />
                    </VariationSection>

                    <OccasionVariations agents={agents} dark={dark} />

                    <KimiPatterns agents={agents} dark={dark} />

                    <VariationSection
                        eyebrow="Wordmark lab"
                        note="Inline cuts in sentence context — HGHT backed off, sized up, and tracked against the squish — plus color trials for dark ground."
                    >
                        <WordmarkLab />
                    </VariationSection>

                    <VariationSection
                        eyebrow="Chip lab"
                        note="The chip vocabulary: bold colored text with a same-color icon, no backgrounds. Agents use their face as the icon and their own color."
                    >
                        <ChipLab agents={agents} dark={dark} />
                    </VariationSection>
                </div>
            </div>
        </div>
    );
}

const proseClassName = 'max-w-[52ch] font-light text-3xl text-muted-foreground italic leading-snug';

/** A1. Scene opens over the Grotto, then the facts stroll in. */
function SceneFirst({ agents, dark }: VariationProps) {
    return (
        <p className={proseClassName}>
            A{' '}
            <Chip icon={Moon02Icon} tone="blue">
                crescent moon
            </Chip>{' '}
            shines softly over the <GrottoMark /> tonight.{' '}
            <AgentChip agents={agents} dark={dark} fallback="Otto" id="agt_primary" />{' '}
            <Chip icon={CheckListIcon} tone="blue">
                closed 3 tasks
            </Chip>{' '}
            before dinner, <AgentChip agents={agents} dark={dark} fallback="Wren" id="agt_wren" />{' '}
            <Chip icon={Megaphone01Icon} tone="pink">
                tuned 24 ad bids
            </Chip>{' '}
            through the afternoon, and Amazon rang up{' '}
            <Chip icon={AmazonIcon} tone="amber">
                $214
            </Chip>
            . Happy{' '}
            <Chip icon={Calendar03Icon} tone="purple">
                Friday
            </Chip>
            .
        </p>
    );
}

/** A2. The Grotto leads and the day unfolds on a clock. */
function DayWithAShape({ agents, dark }: VariationProps) {
    return (
        <p className={proseClassName}>
            A busy day in the <GrottoMark /> today.{' '}
            <AgentChip agents={agents} dark={dark} fallback="Otto" id="agt_primary" />{' '}
            <Chip icon={CheckListIcon} tone="blue">
                closed 3 tasks
            </Chip>{' '}
            before the day had properly begun,{' '}
            <AgentChip agents={agents} dark={dark} fallback="Wren" id="agt_wren" />{' '}
            <Chip icon={Megaphone01Icon} tone="pink">
                tuned 24 ad bids
            </Chip>{' '}
            through the afternoon, and as the{' '}
            <Chip icon={Moon02Icon} tone="blue">
                crescent moon
            </Chip>{' '}
            rose, Amazon had rung up{' '}
            <Chip icon={AmazonIcon} tone="amber">
                $214
            </Chip>
            .
        </p>
    );
}

/** A3. Slow-day floor: mostly prose, a handful of chips. */
function QuietOne({ agents, dark }: VariationProps) {
    return (
        <p className={proseClassName}>
            A quiet{' '}
            <Chip icon={Calendar03Icon} tone="purple">
                Friday
            </Chip>{' '}
            comes to a close, and all is calm in the <GrottoMark />. Amazon rang up{' '}
            <Chip icon={AmazonIcon} tone="amber">
                $214
            </Chip>{' '}
            over the day, Etsy added{' '}
            <Chip icon={Store01Icon} tone="orange">
                4 orders
            </Chip>
            , and in the workshop{' '}
            <AgentChip agents={agents} dark={dark} fallback="Otto" id="agt_primary" />{' '}
            <Chip icon={CheckListIcon} tone="blue">
                closed 3 tasks
            </Chip>{' '}
            before calling it a week.
        </p>
    );
}

interface WordmarkTrial {
    hght: number;
    label: string;
    size: string;
    track: string;
    wght: number;
}

const wordmarkInlineTrials: WordmarkTrial[] = [
    {
        hght: 100,
        label: 'HGHT 100 · 1.08em · flush (previous)',
        size: '1.08em',
        track: '0em',
        wght: 700,
    },
    {
        hght: 80,
        label: 'HGHT 80 · 1.14em · tracked',
        size: '1.14em',
        track: '0.025em',
        wght: 660,
    },
    { hght: 64, label: 'HGHT 64 · 1.22em · tracked', size: '1.22em', track: '0.03em', wght: 630 },
    {
        hght: 46,
        label: 'HGHT 46 · 1.3em · airy (current)',
        size: '1.3em',
        track: '0.035em',
        wght: 600,
    },
    {
        hght: 16,
        label: 'HGHT 16 · 1.42em · greeting cut',
        size: '1.42em',
        track: '0.04em',
        wght: 520,
    },
];

const wordmarkColorTrials = [
    { label: 'brand raw', value: 'var(--brand)' },
    { label: 'brand 52% + white', value: 'color-mix(in srgb, var(--brand) 52%, white)' },
    { label: 'brand 38% + white', value: 'color-mix(in srgb, var(--brand) 38%, white)' },
    { label: 'ink', value: 'var(--color-foreground)' },
];

/** Wordmark cuts judged inline, in the real sentence voice, plus colors. */
function WordmarkLab() {
    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
                {wordmarkInlineTrials.map((trial) => (
                    <figure key={trial.label}>
                        <p className="font-light text-3xl text-muted-foreground italic leading-snug">
                            sparkles over the <TrialMark trial={trial} /> tonight
                        </p>
                        <figcaption className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                            {trial.label}
                        </figcaption>
                    </figure>
                ))}
            </div>
            <div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                    Color · at the current cut
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-x-10 gap-y-6">
                    {wordmarkColorTrials.map((color) => (
                        <figure key={color.label}>
                            <div
                                className="text-5xl leading-none"
                                style={{
                                    color: color.value,
                                    fontFamily: "'Reel Variable', var(--font-heading)",
                                    fontVariationSettings: "'HGHT' 80, 'wght' 660",
                                    letterSpacing: '0.025em',
                                }}
                            >
                                Grotto
                            </div>
                            <figcaption className="mt-2 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                                {color.label}
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TrialMark({ trial }: { trial: WordmarkTrial }) {
    return (
        <span
            className="whitespace-nowrap text-brand not-italic leading-none dark:text-[color-mix(in_srgb,var(--brand)_52%,white)]"
            style={{
                fontFamily: "'Reel Variable', var(--font-heading)",
                fontSize: trial.size,
                fontVariationSettings: `'HGHT' ${trial.hght}, 'wght' ${trial.wght}`,
                letterSpacing: trial.track,
                marginRight: '-0.08em',
            }}
        >
            Grotto
        </span>
    );
}

interface ChipSpec {
    icon: IconSvgElement;
    // Plain muted text after the chip ("on Amazon") — context, never colored.
    suffix?: string;
    text: string;
    tone: ChipTone;
}

// The accumulating chip vocabulary: everything a generated brief sentence is
// allowed to drop inline. Business chips are the metric, not the platform —
// the platform lives in the icon and the muted suffix. Numbers stay numerals.
// Icons reuse the app's existing semantics (tasks = checklist, automations =
// joystick, replies = message).
const chipGroups: { chips: ChipSpec[]; label: string }[] = [
    {
        chips: [
            { icon: Moon02Icon, text: 'crescent moon', tone: 'blue' },
            { icon: Sun01Icon, text: 'sun', tone: 'amber' },
            { icon: CloudAngledRainIcon, text: 'steady rain', tone: 'blue' },
        ],
        label: 'Weather',
    },
    {
        chips: [
            { icon: Calendar03Icon, text: 'Friday', tone: 'purple' },
            { icon: Clock01Icon, text: '3:30 standup', tone: 'purple' },
        ],
        label: 'Time / Date',
    },
    {
        // Marketplace figures wear the marketplace's logo and tone; the
        // green dollar is reserved for money aggregated across sources.
        chips: [
            { icon: AmazonIcon, suffix: 'on Amazon', text: '$214', tone: 'amber' },
            { icon: AmazonIcon, suffix: 'on Amazon', text: '24 sales', tone: 'amber' },
            { icon: Store01Icon, suffix: 'on Etsy', text: '4 orders', tone: 'orange' },
            { icon: DollarCircleIcon, suffix: 'across the shops', text: '$412', tone: 'green' },
            { icon: ShoppingBasket02Icon, suffix: 'to ship', text: '6 orders', tone: 'green' },
        ],
        label: 'Business',
    },
    {
        // Action chips carry their verb — a bare "3 tasks" is ambiguous.
        chips: [
            { icon: CheckListIcon, text: 'closed 3 tasks', tone: 'blue' },
            { icon: Message01Icon, text: 'sent 12 replies', tone: 'blue' },
            { icon: Megaphone01Icon, text: 'tuned 24 ad bids', tone: 'pink' },
            { icon: Joystick04Icon, text: 'ran Morning digest', tone: 'purple' },
        ],
        label: 'Agent work',
    },
    {
        // Morning-stance chips: the queue instead of the tally. State or
        // schedule lives inside the chip for the same ambiguity reason.
        chips: [
            { icon: CheckListIcon, text: '3 tasks waiting', tone: 'blue' },
            { icon: Joystick04Icon, text: 'Morning digest at 9:00', tone: 'purple' },
        ],
        label: 'Upcoming',
    },
    {
        chips: [
            { icon: GiftIcon, text: 'Christmas Eve', tone: 'red' },
            { icon: PumpkinIcon, text: 'Halloween', tone: 'orange' },
            { icon: FireworksIcon, text: 'New Year’s Eve', tone: 'purple' },
            { icon: BirthdayCakeIcon, text: 'your birthday', tone: 'pink' },
        ],
        label: 'Holidays',
    },
];

/** Every designed chip at brief scale, grouped by what it describes. */
function ChipLab({ agents, dark }: VariationProps) {
    return (
        <div className="flex flex-col gap-8">
            {chipGroups.map((group) => (
                <div key={group.label}>
                    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                        {group.label}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-3 text-3xl">
                        {group.chips.map((chip) => (
                            <span className="whitespace-nowrap" key={chip.text}>
                                <Chip icon={chip.icon} tone={chip.tone}>
                                    {chip.text}
                                </Chip>
                                {chip.suffix ? (
                                    <span className="text-muted-foreground"> {chip.suffix}</span>
                                ) : null}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
            <div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                    Agents
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-3 text-3xl">
                    <AgentChip agents={agents} dark={dark} fallback="Otto" id="agt_primary" />
                    <AgentChip agents={agents} dark={dark} fallback="Wren" id="agt_wren" />
                </div>
            </div>
        </div>
    );
}
