import { EmptyState } from '@heroui-pro/react';
import type { IconSvgElement } from '@hugeicons/react';
import { Icon } from '../../components/ui/icon.tsx';
import { SectionHeader } from './section-header.tsx';

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
            <SectionHeader
                leading={<Icon aria-hidden="true" className="text-muted" icon={icon} size={18} />}
                title={title}
            />
            <div className="flex min-h-0 flex-1 items-center justify-center">
                <EmptyState>
                    <EmptyState.Header>
                        <EmptyState.Media variant="icon">
                            <Icon aria-hidden="true" icon={icon} />
                        </EmptyState.Media>
                        <EmptyState.Title>{title}</EmptyState.Title>
                        <EmptyState.Description>{description}</EmptyState.Description>
                    </EmptyState.Header>
                </EmptyState>
            </div>
        </div>
    );
}
