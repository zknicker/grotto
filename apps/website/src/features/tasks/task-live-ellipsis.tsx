import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils.ts';
import { taskMarkMotion } from './task-mark-model.ts';

/**
 * Somebody is on this right now.
 *
 * Three dots breathing in place, at the header line's scale and in whatever
 * ink the mark around it is using. It is the only thing in that row that
 * moves, which is the whole reason it reads: an "on it" affordance stops being
 * one the moment it competes with something else. Reduced motion keeps the
 * dots and stops the breathing — the mark still says the work is claimed.
 */
export function TaskLiveEllipsis({ className }: { className?: string }) {
    const plan = taskMarkMotion(useReducedMotion() === true);

    return (
        <span
            aria-hidden="true"
            className={cn('inline-flex shrink-0 items-center gap-[3px]', className)}
            data-testid="task-live-ellipsis"
        >
            {plan.dots.map((dot) => (
                <motion.span
                    animate={plan.animated ? { opacity: [0.35, 1, 0.35] } : undefined}
                    className="size-[3px] rounded-full bg-current"
                    initial={{ opacity: plan.animated ? 0.35 : 0.7 }}
                    key={dot.id}
                    transition={
                        plan.animated
                            ? {
                                  delay: dot.delay,
                                  duration: 1.1,
                                  ease: 'easeInOut',
                                  repeat: Number.POSITIVE_INFINITY,
                              }
                            : undefined
                    }
                />
            ))}
        </span>
    );
}
