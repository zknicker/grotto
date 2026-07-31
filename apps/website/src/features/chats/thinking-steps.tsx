import type { HugeiconsIconProps } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { motion, useReducedMotion } from 'framer-motion';
import {
    createContext,
    forwardRef,
    type HTMLAttributes,
    type ReactNode,
    useContext,
    useMemo,
    useState,
} from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import {
    Collapsible,
    CollapsiblePanel,
    CollapsibleTrigger,
} from '../../components/ui/collapsible.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { StatusDot } from '../../components/ui/status-dot.tsx';
import { cn } from '../../lib/utils.ts';

type StepStatus = 'active' | 'complete' | 'pending' | 'failed';
type StepIcon = HugeiconsIconProps['icon'];

const springs = {
    drawer: {
        bounce: 0,
        duration: 0.22,
        type: 'spring' as const,
    },
    slow: {
        bounce: 0.15,
        duration: 0.24,
        type: 'spring' as const,
    },
};

const ThinkingStepsOpenContext = createContext(false);

interface ThinkingStepsProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
}

export const ThinkingSteps = forwardRef<HTMLDivElement, ThinkingStepsProps>(
    (
        {
            children,
            className,
            defaultOpen = true,
            onOpenChange,
            open,
            // Collapsible does not use defaultValue; keep this compatible with the registry shape.
            defaultValue: _defaultValue,
            ...props
        },
        ref
    ) => {
        const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
        const currentOpen = open ?? uncontrolledOpen;
        const handleOpenChange = (nextOpen: boolean) => {
            if (open === undefined) {
                setUncontrolledOpen(nextOpen);
            }

            onOpenChange?.(nextOpen);
        };

        return (
            <ThinkingStepsOpenContext.Provider value={currentOpen}>
                <Collapsible
                    className={cn('w-80 max-w-full', className)}
                    onOpenChange={handleOpenChange}
                    open={currentOpen}
                    ref={ref}
                    {...props}
                >
                    {children}
                </Collapsible>
            </ThinkingStepsOpenContext.Provider>
        );
    }
);

ThinkingSteps.displayName = 'ThinkingSteps';

interface ThinkingStepsHeaderProps extends HTMLAttributes<HTMLButtonElement> {
    children?: ReactNode;
    showIcon?: boolean;
    wrapperClassName?: string;
}

export const ThinkingStepsHeader = forwardRef<HTMLButtonElement, ThinkingStepsHeaderProps>(
    ({ children = 'Thinking', className, showIcon = true, wrapperClassName, ...props }, ref) => (
        // text-meta rides the wrapper: merging a size token with the trigger's
        // color classes would collapse them into one utility.
        <div className={cn('w-fit text-meta', wrapperClassName)}>
            <CollapsibleTrigger
                className={cn(
                    'group flex w-auto items-center gap-1.5 rounded-md py-1 font-medium text-foreground leading-tight transition-colors hover:text-foreground',
                    className
                )}
                ref={ref}
                {...props}
            >
                <span>{children}</span>
                {showIcon ? (
                    <Icon
                        className="size-3.5 -rotate-90 text-muted-foreground transition-transform group-data-[panel-open]:rotate-0"
                        icon={ArrowDown01Icon}
                        strokeWidth={1.7}
                    />
                ) : null}
            </CollapsibleTrigger>
        </div>
    )
);

ThinkingStepsHeader.displayName = 'ThinkingStepsHeader';

interface ThinkingStepsContentProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}

export const ThinkingStepsContent = forwardRef<HTMLDivElement, ThinkingStepsContentProps>(
    ({ children, className, ...props }, ref) => {
        const open = useContext(ThinkingStepsOpenContext);
        const shouldReduceMotion = useReducedMotion();
        const transition = useMemo(
            () =>
                shouldReduceMotion
                    ? { duration: 0 }
                    : {
                          ...springs.drawer,
                      },
            [shouldReduceMotion]
        );

        return (
            <motion.div
                animate={{ height: open ? 'auto' : 0 }}
                aria-hidden={!open}
                className="overflow-hidden"
                inert={open ? undefined : true}
                initial={false}
                onAnimationComplete={dispatchDisclosureAnimationEnd}
                transition={transition}
            >
                <div className={cn('flex flex-col', className)} ref={ref} {...props}>
                    {children}
                </div>
            </motion.div>
        );
    }
);

ThinkingStepsContent.displayName = 'ThinkingStepsContent';

interface ThinkingStepProps {
    animateEnter?: boolean;
    children?: ReactNode;
    className?: string;
    delay?: number;
    description?: ReactNode;
    icon?: StepIcon;
    index: number;
    isLast?: boolean;
    label: ReactNode;
    showIcon?: boolean;
    status?: StepStatus;
}

export function ThinkingStep({
    animateEnter = false,
    children,
    className,
    delay = 0,
    description,
    icon,
    isLast = false,
    label,
    showIcon = true,
    status = 'complete',
}: ThinkingStepProps) {
    const shouldReduceMotion = useReducedMotion();

    if (status === 'pending') {
        return null;
    }

    const isActive = status === 'active';

    return (
        <motion.div
            animate={{ height: 'auto' }}
            className={cn('relative z-10 overflow-hidden', className)}
            initial={animateEnter && !shouldReduceMotion ? { height: 0 } : false}
            transition={shouldReduceMotion ? { duration: 0 } : springs.slow}
        >
            <motion.div
                animate={{ opacity: 1 }}
                initial={animateEnter && !shouldReduceMotion ? { opacity: 0 } : false}
                transition={{
                    delay: shouldReduceMotion ? 0 : Math.max(delay, 0.08),
                    duration: shouldReduceMotion ? 0 : 0.24,
                    ease: 'easeOut',
                }}
            >
                <div className="flex gap-2.5 px-2 py-1.5">
                    <div className="flex w-4 shrink-0 flex-col items-center">
                        <div className="flex size-4 items-center justify-center">
                            {showIcon && icon ? (
                                <Icon
                                    className="size-4 text-muted-foreground"
                                    icon={icon}
                                    strokeWidth={1.5}
                                />
                            ) : (
                                <div className="flex size-4 items-center justify-center">
                                    <StatusDot
                                        pulse={isActive}
                                        status={
                                            status === 'failed'
                                                ? 'error'
                                                : isActive
                                                  ? 'info'
                                                  : 'muted'
                                        }
                                    />
                                </div>
                            )}
                        </div>
                        {isLast ? null : <div className="mt-1 w-px flex-1 bg-border-subtle" />}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1 text-meta">
                        <span
                            className={cn(
                                'min-w-0 text-foreground leading-tight',
                                isActive && 'thinking-indicator-text'
                            )}
                        >
                            {label}
                        </span>
                        {description ? (
                            <span className="min-w-0 text-meta text-muted-foreground leading-snug">
                                {description}
                            </span>
                        ) : null}
                        {children}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

interface ThinkingStepDetailsProps {
    children?: ReactNode;
    className?: string;
    defaultOpen?: boolean;
    details?: string[];
    summary: string;
}

export function ThinkingStepDetails({
    children,
    className,
    defaultOpen = false,
    details,
    summary,
}: ThinkingStepDetailsProps) {
    return (
        <Collapsible className={cn('mt-1 -ml-3', className)} defaultOpen={defaultOpen}>
            <div className="w-fit">
                <CollapsibleTrigger className="group flex w-auto items-center gap-1.5 rounded-md px-3 py-1 text-meta text-muted-foreground leading-tight hover:bg-legacy-muted hover:text-foreground">
                    <span>{summary}</span>
                    <Icon
                        className="size-3 -rotate-90 opacity-70 transition-transform group-data-[panel-open]:rotate-0"
                        icon={ArrowDown01Icon}
                        strokeWidth={1.7}
                    />
                </CollapsibleTrigger>
            </div>
            <CollapsiblePanel>
                <div className="flex flex-col gap-0.5 pt-0.5">
                    {details?.map((item) => (
                        <span className="text-meta text-muted-foreground leading-snug" key={item}>
                            {item}
                        </span>
                    ))}
                    {children}
                </div>
            </CollapsiblePanel>
        </Collapsible>
    );
}

interface ThinkingStepSourcesProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}

export const ThinkingStepSources = forwardRef<HTMLDivElement, ThinkingStepSourcesProps>(
    ({ children, className, ...props }, ref) => (
        <div className={cn('mt-1 flex flex-wrap gap-1.5', className)} ref={ref} {...props}>
            {children}
        </div>
    )
);

ThinkingStepSources.displayName = 'ThinkingStepSources';

interface ThinkingStepSourceProps {
    children: ReactNode;
    className?: string;
    delay?: number;
    variant?: 'error' | 'info' | 'secondary' | 'subtle' | 'success';
}

export function ThinkingStepSource({
    children,
    className,
    delay = 0,
    variant = 'subtle',
}: ThinkingStepSourceProps) {
    return (
        <span
            className="motion-safe:animate-[chat-loading-indicator-in_220ms_cubic-bezier(0.23,1,0.32,1)_both]"
            style={{ animationDelay: `${delay}s` }}
        >
            <Badge className={className} size="sm" variant={variant}>
                {children}
            </Badge>
        </span>
    );
}

export type { ThinkingStepImageProps } from './thinking-step-image.tsx';
export { ThinkingStepImage } from './thinking-step-image.tsx';

export type {
    StepStatus,
    ThinkingStepDetailsProps,
    ThinkingStepProps,
    ThinkingStepSourceProps,
    ThinkingStepSourcesProps,
    ThinkingStepsContentProps,
    ThinkingStepsHeaderProps,
    ThinkingStepsProps,
};

function dispatchDisclosureAnimationEnd() {
    document.dispatchEvent(new CustomEvent('chat-disclosure-animation-end', { bubbles: true }));
}
