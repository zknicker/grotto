import type { TranscriptDelivery } from '../../../chats/transcript-contract.ts';
import { DeliveryCard } from '../delivery-card.tsx';

export function DeliveryLogEntry({
    currentSessionKey,
    delivery,
}: {
    currentSessionKey: string;
    delivery: TranscriptDelivery;
}) {
    return <DeliveryCard currentSessionKey={currentSessionKey} delivery={delivery} />;
}
