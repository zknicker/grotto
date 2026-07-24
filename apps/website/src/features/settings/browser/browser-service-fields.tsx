import type { HugeiconsIconProps } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { ReactNode } from 'react';
import {
    Collapsible,
    CollapsiblePanel,
    CollapsibleTrigger,
} from '../../../components/ui/collapsible.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import type { BrowserConfigField } from './browser-config-fields.tsx';

export interface BrowserServiceDescriptor<TDraft> {
    description: string;
    fields?: readonly BrowserConfigField<TDraft>[];
    icon?: HugeiconsIconProps['icon'];
    id: string;
    name: string;
    read: (draft: TDraft) => boolean;
    write: (draft: TDraft, enabled: boolean) => TDraft;
}

export function BrowserSection({
    action,
    children,
    description,
    title,
}: {
    action?: ReactNode;
    children: ReactNode;
    description?: ReactNode;
    title?: ReactNode;
}) {
    return (
        <section className="grid gap-2.5">
            {title || action ? (
                <div className="flex items-center gap-2">
                    {title ? (
                        <h3 className="font-medium text-foreground text-sm">{title}</h3>
                    ) : null}
                    {action ? (
                        <span className="ml-auto flex items-center gap-1">{action}</span>
                    ) : null}
                </div>
            ) : null}
            {description ? (
                <p className="-mt-1 text-muted-foreground text-sm leading-relaxed">{description}</p>
            ) : null}
            {children}
        </section>
    );
}

export function BrowserServiceList({ children }: { children: ReactNode }) {
    return (
        <div className="divide-y divide-border/60 rounded-lg border border-border/70">
            {children}
        </div>
    );
}

export function BrowserSectionStack({ children }: { children: ReactNode }) {
    return <div className="grid gap-5">{children}</div>;
}

export function BrowserServiceRow({
    children,
    control,
    description,
    icon,
    label,
}: {
    children?: ReactNode;
    control: ReactNode;
    description?: ReactNode;
    icon?: HugeiconsIconProps['icon'];
    label: ReactNode;
}) {
    return (
        <div className="grid gap-3 px-3 py-2.5">
            <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2.5">
                    {icon ? (
                        <Icon className="size-4 shrink-0 text-muted-foreground" icon={icon} />
                    ) : null}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-foreground text-sm">
                            {label}
                        </div>
                        {description ? (
                            <div className="text-muted-foreground text-sm leading-relaxed">
                                {description}
                            </div>
                        ) : null}
                    </div>
                </div>
                {control}
            </div>
            {children ? <div className="border-border/60 border-t pt-3">{children}</div> : null}
        </div>
    );
}

export function BrowserDisclosure({
    children,
    defaultOpen = false,
    label,
    onOpenChange,
    open,
}: {
    children: ReactNode;
    defaultOpen?: boolean;
    label: ReactNode;
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
}) {
    return (
        <Collapsible defaultOpen={defaultOpen} onOpenChange={onOpenChange} open={open}>
            <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded-md py-1 text-muted-foreground text-sm hover:text-foreground">
                <Icon
                    className="size-3 transition-transform group-data-[panel-open]:rotate-90"
                    icon={ArrowRight01Icon}
                />
                {label}
            </CollapsibleTrigger>
            <CollapsiblePanel>
                <div className="grid gap-4 pt-2">{children}</div>
            </CollapsiblePanel>
        </Collapsible>
    );
}
