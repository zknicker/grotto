import {
    AmazonIcon,
    CheckListIcon,
    Clock01Icon,
    GiftIcon,
    Joystick04Icon,
    Megaphone01Icon,
    Moon02Icon,
    Store01Icon,
    Sun01Icon,
} from '@hugeicons-pro/core-solid-rounded';
import {
    AgentChip,
    Chip,
    GrottoMark,
    type VariationProps,
    VariationSection,
} from './brief-variations-shared.tsx';

const proseClassName = 'max-w-[52ch] font-light text-3xl text-muted italic leading-snug';

// The day cycle's missing morning stance plus occasion overlays
// (specs/home-brief.md): weekends, holidays, the small hours, and the
// occasional light register. One occasion per brief, ever.
export function OccasionVariations({ agents, dark }: VariationProps) {
    return (
        <>
            <VariationSection
                eyebrow="M — The open (morning)"
                note="Aspirational stance: nothing has happened yet, so the brief reports the queue. Upcoming chips carry their schedule."
            >
                <p className={proseClassName}>
                    The{' '}
                    <Chip icon={Sun01Icon} tone="amber">
                        sun
                    </Chip>{' '}
                    is up over the <GrottoMark />, and the day is still ahead.{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Otto" id="agt_primary" /> has{' '}
                    <Chip icon={CheckListIcon} tone="blue">
                        3 tasks waiting
                    </Chip>
                    , the{' '}
                    <Chip icon={Joystick04Icon} tone="purple">
                        Morning digest at 9:00
                    </Chip>{' '}
                    is first on the docket, and a{' '}
                    <Chip icon={Clock01Icon} tone="purple">
                        3:30 standup
                    </Chip>{' '}
                    rounds out the afternoon.
                </p>
            </VariationSection>

            <VariationSection
                eyebrow="O1 — The small hours"
                note="Deep night: the narrator may gently notice the hour and the reader. Nothing is urgent; say so."
            >
                <p className={proseClassName}>
                    It is three in the morning, and all is still in the <GrottoMark />. The{' '}
                    <Chip icon={Moon02Icon} tone="blue">
                        crescent moon
                    </Chip>{' '}
                    keeps watch,{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Otto" id="agt_primary" /> and{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Wren" id="agt_wren" /> have the
                    night off, and yesterday ended at{' '}
                    <Chip icon={AmazonIcon} tone="amber">
                        $214
                    </Chip>{' '}
                    on Amazon. Nothing needs you until morning.
                </p>
            </VariationSection>

            <VariationSection
                eyebrow="O2 — The weekend"
                note="Weekends run slower and softer; not much may be stirring, and that is fine to say."
            >
                <p className={proseClassName}>
                    A slow Saturday drifts by in the <GrottoMark />. Etsy picked up{' '}
                    <Chip icon={Store01Icon} tone="orange">
                        2 orders
                    </Chip>{' '}
                    this morning,{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Wren" id="agt_wren" />{' '}
                    <Chip icon={Megaphone01Icon} tone="pink">
                        tuned 6 ad bids
                    </Chip>{' '}
                    around lunch, and not much else is stirring. Enjoy the weekend.
                </p>
            </VariationSection>

            <VariationSection
                eyebrow="O3 — A light day"
                note="The occasional playful register: whimsy in the Pooh key, never comedy, never at the data's expense."
            >
                <p className={proseClassName}>
                    Word around the <GrottoMark /> is that{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Wren" id="agt_wren" /> cannot
                    stop tinkering, having{' '}
                    <Chip icon={Megaphone01Icon} tone="pink">
                        tuned 24 ad bids
                    </Chip>{' '}
                    by lunch.{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Otto" id="agt_primary" />, not
                    to be outdone,{' '}
                    <Chip icon={CheckListIcon} tone="blue">
                        closed 3 tasks
                    </Chip>
                    . Amazon sits at{' '}
                    <Chip icon={AmazonIcon} tone="amber">
                        $214
                    </Chip>
                    , which everyone agrees is a fine number.
                </p>
            </VariationSection>

            <VariationSection
                eyebrow="O4 — The holiday"
                note="Holidays are named plainly and woven into the scenery."
            >
                <p className={proseClassName}>
                    It is{' '}
                    <Chip icon={GiftIcon} tone="red">
                        Christmas Eve
                    </Chip>{' '}
                    in the <GrottoMark />, and the lights feel warmer for it.{' '}
                    <AgentChip agents={agents} dark={dark} fallback="Otto" id="agt_primary" />{' '}
                    <Chip icon={CheckListIcon} tone="blue">
                        closed 3 tasks
                    </Chip>{' '}
                    this afternoon, Amazon wound down at{' '}
                    <Chip icon={AmazonIcon} tone="amber">
                        $214
                    </Chip>
                    , and nothing more is asked of anyone tonight.
                </p>
            </VariationSection>
        </>
    );
}
