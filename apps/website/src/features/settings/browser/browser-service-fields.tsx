import { Accordion } from '@heroui/react';
import type { HugeiconsIconProps } from '@hugeicons/react';
import type { ReactNode } from 'react';
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
    children?: ReactNode;
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
                <p className="-mt-1 text-muted text-sm leading-relaxed">{description}</p>
            ) : null}
            {children}
        </section>
    );
}

export function BrowserServiceList({ children }: { children: ReactNode }) {
    return <div className="grid gap-3">{children}</div>;
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
                    {icon ? <Icon className="size-4 shrink-0 text-muted" icon={icon} /> : null}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-foreground text-sm">
                            {label}
                        </div>
                        {description ? (
                            <div className="text-muted text-sm leading-relaxed">{description}</div>
                        ) : null}
                    </div>
                </div>
                {control}
            </div>
            {children ? <div className="pt-1">{children}</div> : null}
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
        <Accordion
            defaultExpandedKeys={defaultOpen ? ['browser-disclosure'] : []}
            expandedKeys={open === undefined ? undefined : open ? ['browser-disclosure'] : []}
            hideSeparator
            onExpandedChange={(keys) => onOpenChange?.(keys.has('browser-disclosure'))}
        >
            <Accordion.Item id="browser-disclosure">
                <Accordion.Heading>
                    <Accordion.Trigger>
                        {label}
                        <Accordion.Indicator />
                    </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                    <Accordion.Body>
                        <div className="grid gap-4">{children}</div>
                    </Accordion.Body>
                </Accordion.Panel>
            </Accordion.Item>
        </Accordion>
    );
}
