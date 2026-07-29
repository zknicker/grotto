import type { SessionHistoryDeliveryOutput } from '../../../lib/trpc.tsx';

export function DeliveryCard({
    currentSessionKey,
    delivery,
}: {
    currentSessionKey: string;
    delivery: SessionHistoryDeliveryOutput;
}) {
    const outgoing = delivery.parentSessionKey === currentSessionKey;
    const targetSessionKey = outgoing ? delivery.childSessionKey : delivery.parentSessionKey;
    const targetLabel = outgoing ? delivery.childSessionName : delivery.parentSessionName;

    return (
        <div
            className={`flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left ${
                outgoing
                    ? 'border-[color:var(--info-border)] bg-[var(--info-bg)]'
                    : 'border-[color:var(--warning-border)] bg-[var(--warning-bg)]'
            }`}
        >
            <span
                className={`font-medium text-caption uppercase tracking-[0.16em] ${
                    outgoing ? 'text-info' : 'text-warning'
                }`}
            >
                {outgoing ? `Delivered to ${targetLabel}` : `Delivered from ${targetLabel}`}
            </span>
            <span className="line-clamp-3 text-foreground text-sm">
                {delivery.messageText ?? targetLabel}
            </span>
            <span className="font-mono text-caption text-muted-foreground">{targetSessionKey}</span>
        </div>
    );
}
