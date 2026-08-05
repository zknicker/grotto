import { Spinner } from '@heroui/react';

export function AgentLoading({ label }: { label: string }) {
    return (
        <p className="flex items-center gap-2 py-10 text-muted text-sm">
            <Spinner size="sm" />
            {label}
        </p>
    );
}
