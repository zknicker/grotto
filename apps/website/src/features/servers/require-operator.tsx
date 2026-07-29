import type { ServerRole } from '@tavern/api/hosted-membership';
import type React from 'react';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../components/ui/empty.tsx';

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
        <Empty className="h-full">
            <EmptyHeader>
                <EmptyTitle>Owner or Admin required</EmptyTitle>
                {description ? <EmptyDescription>{description}</EmptyDescription> : null}
            </EmptyHeader>
        </Empty>
    );
}
