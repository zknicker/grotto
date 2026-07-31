import { EmptyState } from '@heroui-pro/react';
import type { ServerRole } from '@tavern/api/hosted-membership';
import type React from 'react';

/**
 * Operator-only gate for Server admin surfaces. Members see one shared empty
 * state instead of each page hand-rolling its own centered message.
 */
export function RequireOperator({
    children,
    description,
    role,
}: {
    children: React.ReactNode;
    description?: string;
    role: ServerRole;
}): React.ReactElement {
    if (role === 'owner' || role === 'admin') {
        return <>{children}</>;
    }

    return (
        <div className="flex h-full items-center justify-center">
            <EmptyState>
                <EmptyState.Header>
                    <EmptyState.Title>Owner or Admin required</EmptyState.Title>
                    {description ? (
                        <EmptyState.Description>{description}</EmptyState.Description>
                    ) : null}
                </EmptyState.Header>
            </EmptyState>
        </div>
    );
}
