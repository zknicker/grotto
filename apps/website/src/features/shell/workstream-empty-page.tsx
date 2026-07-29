import type { IconSvgElement } from '@hugeicons/react';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '../../components/ui/empty.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { PaneTopbar } from '../../components/ui/pane.tsx';

/**
 * Honest empty state for a rail tab whose workstream has not landed yet
 * (specs/tasks.md). Keeps the tab reachable and truthful about what's
 * missing instead of hiding it or faking data.
 */
export function WorkstreamEmptyPage({
    description,
    icon,
    title,
}: {
    description: string;
    icon: IconSvgElement;
    title: string;
}) {
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <PaneTopbar>
                <Icon
                    aria-hidden="true"
                    className="size-4.5 text-muted-foreground"
                    icon={icon}
                    size={20}
                />
                <h1 className="font-semibold text-foreground text-sm">{title}</h1>
            </PaneTopbar>
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Icon icon={icon} />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">{title}</EmptyTitle>
                    <EmptyDescription className="text-sm">{description}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        </div>
    );
}
