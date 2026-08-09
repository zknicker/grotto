import { Button, Spinner } from '@heroui/react';
import { AlertCircleIcon, CheckmarkCircle02Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';
import type { CoveStatusLine } from './cove-onboarding-prototype/cove-prototype-model.ts';

/** Every onboarding step keeps the same escape hatch. */
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
