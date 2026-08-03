import {
    AmazonIcon,
    Calendar03Icon,
    CheckListIcon,
    Megaphone01Icon,
    Moon02Icon,
    Store01Icon,
} from '@hugeicons-pro/core-solid-rounded';
import {
    AgentChip,
    Chip,
    GrottoMark,
    type VariationProps,
    VariationSection,
} from './brief-variations-shared.tsx';

const proseClassName = 'max-w-[52ch] font-light text-3xl text-muted italic leading-snug';

// Kimi K3's round-2 sentence patterns, re-cut to the house rules
// (specs/home-brief.md): storybook narrator, no decorative adverbs, named
// sources, moment-in-time framing, verbs inside action chips.
export function KimiPatterns({ agents, dark }: VariationProps) {
    return (
        <>
            <VariationSection
                eyebrow="K1 — Last light"
                note="Scene settles over the wordmark, two agent beats, the day's revenue lands the sentence."
            >
                <p className={proseClassName}>
                    A{' '}
                    <Chip icon={Moon02Icon} tone="blue">
                        crescent moon
                    </Chip>{' '}
                    hangs over the <GrottoMark /> as evening settles in.{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Otto" id="agt_primary" />{' '}
                    <Chip icon={CheckListIcon} tone="blue">
                        closed 3 tasks
                    </Chip>{' '}
                    before the light went,{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Wren" id="agt_wren" />{' '}
                    <Chip icon={Megaphone01Icon} tone="pink">
                        tuned 24 ad bids
                    </Chip>{' '}
                    through the afternoon, and Amazon rang up{' '}
                    <Chip icon={AmazonIcon} tone="amber">
                        $214
                    </Chip>{' '}
                    for the day.
                </p>
            </VariationSection>

            <VariationSection
                eyebrow="K2 — Midday check"
                note="A moment-in-time snapshot; the brief regenerates through the day, so it reads so-far, never at-close."
            >
                <p className={proseClassName}>
                    In the <GrottoMark />, the morning has come and gone.{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Otto" id="agt_primary" />{' '}
                    <Chip icon={CheckListIcon} tone="blue">
                        closed 3 tasks
                    </Chip>{' '}
                    before lunch,{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Wren" id="agt_wren" />{' '}
                    <Chip icon={Megaphone01Icon} tone="pink">
                        tuned 24 ad bids
                    </Chip>{' '}
                    just now, and Amazon sits at{' '}
                    <Chip icon={AmazonIcon} tone="amber">
                        $214
                    </Chip>{' '}
                    so far.
                </p>
            </VariationSection>

            <VariationSection
                eyebrow="K3 — Money first"
                note="Revenue headline with named sources, agent beats follow. Only on strong-revenue days."
            >
                <p className={proseClassName}>
                    The afternoon has gone well in the <GrottoMark />. Amazon holds{' '}
                    <Chip icon={AmazonIcon} tone="amber">
                        $214
                    </Chip>{' '}
                    so far, Etsy has added{' '}
                    <Chip icon={Store01Icon} tone="orange">
                        4 orders
                    </Chip>
                    , and in the workshop{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Otto" id="agt_primary" />{' '}
                    <Chip icon={CheckListIcon} tone="blue">
                        closed 3 tasks
                    </Chip>
                    . Down the hall,{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Wren" id="agt_wren" />{' '}
                    <Chip icon={Megaphone01Icon} tone="pink">
                        tuned 24 ad bids
                    </Chip>
                    .
                </p>
            </VariationSection>

            <VariationSection
                eyebrow="K4 — The close"
                note="The scene winds the week down. Storybook narrator, no asides."
            >
                <p className={proseClassName}>
                    Under a{' '}
                    <Chip icon={Moon02Icon} tone="blue">
                        crescent moon
                    </Chip>
                    , another week in the <GrottoMark /> comes to a close.{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Otto" id="agt_primary" />{' '}
                    <Chip icon={CheckListIcon} tone="blue">
                        closed 3 tasks
                    </Chip>{' '}
                    over the day,{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Wren" id="agt_wren" />{' '}
                    <Chip icon={Megaphone01Icon} tone="pink">
                        tuned 24 ad bids
                    </Chip>{' '}
                    this afternoon, and Amazon rang up{' '}
                    <Chip icon={AmazonIcon} tone="amber">
                        $214
                    </Chip>{' '}
                    along the way.
                </p>
            </VariationSection>

            <VariationSection
                eyebrow="K5 — Fragments"
                note="One short clause per fact. The density regulator when facts pile up."
            >
                <p className={proseClassName}>
                    The lights dim serenely throughout the <GrottoMark /> at the close of a good{' '}
                    <Chip icon={Calendar03Icon} tone="purple">
                        Friday
                    </Chip>
                    . Through the day,{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Otto" id="agt_primary" />{' '}
                    <Chip icon={CheckListIcon} tone="blue">
                        closed 3 tasks
                    </Chip>
                    . By evening,{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Wren" id="agt_wren" />{' '}
                    <Chip icon={Megaphone01Icon} tone="pink">
                        tuned 24 ad bids
                    </Chip>
                    . Amazon ends the day at{' '}
                    <Chip icon={AmazonIcon} tone="amber">
                        $214
                    </Chip>
                    .
                </p>
            </VariationSection>
        </>
    );
}
