import { Button, Spinner } from '@heroui/react';
import { AlertCircleIcon, CheckmarkCircle02Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { TavernLogo } from '../../../components/tavern-logo.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { cn } from '../../../lib/utils.ts';
import type { CoveStatusLine } from './cove-prototype-model.ts';

export function StepHeading({ title }: { title: string }) {
    return (
        <header className="cove-step-heading">
            <TavernLogo aria-hidden="true" className="cove-step-heading__logo" />
            <h1 className="text-balance font-semibold text-2xl tracking-tight sm:text-3xl">
                {title}
            </h1>
        </header>
    );
}

/** The shared page section for each static onboarding step. */
export function StepSection({
    children,
    className,
    footer,
    title,
}: {
    children?: React.ReactNode;
    className?: string;
    footer?: React.ReactNode;
    title: string;
}) {
    return (
        <section className={cn('w-full', className)}>
            <StepHeading title={title} />
            {children ? <div className="cove-step-content">{children}</div> : null}
            {footer ? <footer className="cove-step-footer">{footer}</footer> : null}
        </section>
    );
}

/** Static prototype affordance: every step keeps the same escape hatch. */
export function SwitchServerButton({ onPress }: { onPress: () => void }) {
    return (
        <Button onPress={onPress} variant="ghost">
            Switch Server
        </Button>
    );
}

export function StatusLineList({ lines }: { lines: CoveStatusLine[] }) {
    if (lines.length === 0) {
        return null;
    }

    return (
        <ul className="grid gap-1.5">
            {lines.map((line) => (
                <li className="flex items-start gap-2 text-base sm:text-sm" key={line.label}>
                    <StatusLineIcon tone={line.tone} />
                    <span className={line.tone === 'waiting' ? 'text-muted' : undefined}>
                        {line.label}
                    </span>
                </li>
            ))}
        </ul>
    );
}

/**
 * A 16px mark sitting on the first line of a label that wraps on narrow
 * viewports, so it stays fixed-size and top-aligned rather than centering
 * against the whole block.
 */
function StatusLineIcon({ tone }: { tone: CoveStatusLine['tone'] }) {
    if (tone === 'waiting') {
        return <Spinner aria-hidden="true" className="mt-0.5 shrink-0" size="sm" />;
    }

    return (
        <Icon
            aria-hidden="true"
            className={cn('mt-0.5 shrink-0', tone === 'failed' ? 'text-danger' : 'text-success')}
            icon={tone === 'failed' ? AlertCircleIcon : CheckmarkCircle02Icon}
            size={16}
        />
    );
}
