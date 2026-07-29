import { Spinner } from '../../../components/ui/spinner.tsx';

export function HostedAgentTabLoading({ label }: { label: string }) {
    return (
        <p className="flex items-center gap-2 py-10 text-base text-muted-foreground sm:text-sm">
            <Spinner className="size-4" />
            {label}
        </p>
    );
}
