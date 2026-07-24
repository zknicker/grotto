import type * as React from 'react';
import { Switch } from '../../../components/ui/switch.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip.tsx';

/**
 * Browser enable switch that locks with a hover tooltip instead of an inline
 * badge when the tool cannot be enabled yet.
 */
export function BrowserEnablementSwitch({
    lockReason,
    ...props
}: React.ComponentProps<typeof Switch> & {
    lockReason: string | null;
}) {
    if (!lockReason) {
        return <Switch {...props} />;
    }

    return (
        <Tooltip>
            <TooltipTrigger render={<span className="inline-flex cursor-default" />}>
                <Switch {...props} disabled />
            </TooltipTrigger>
            <TooltipContent className="max-w-64" side="left">
                {lockReason}
            </TooltipContent>
        </Tooltip>
    );
}
