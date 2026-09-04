import { Button } from '@heroui/react';
import type { TriggerKindOption } from './agent-trigger-model.ts';
import { TriggerValueBlock } from './trigger-webhook-card.tsx';

/**
 * Where an existing Trigger is reached, and the one control that changes it.
 * A rotated secret is readable only in the response that minted it, so it goes
 * to the card pinned at the top of the drawer rather than appearing here — the
 * shown-once values stay in one place no matter which mint produced them.
 */
export function TriggerWhenToRun({
    kind,
    onRotate,
    rotatePending,
    url,
}: {
    kind: TriggerKindOption;
    onRotate: () => void;
    rotatePending: boolean;
    url: string;
}) {
    return (
        <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                    <span className="font-medium text-foreground text-sm">When to run</span>
                    <span className="truncate text-muted text-sm">
                        {`${kind.label} — ${kind.description}`}
                    </span>
                </div>
                <Button
                    isDisabled={rotatePending}
                    onPress={onRotate}
                    size="sm"
                    type="button"
                    variant="secondary"
                >
                    Rotate Secret
                </Button>
            </div>
            <TriggerValueBlock code={url} label="URL" />
        </div>
    );
}
