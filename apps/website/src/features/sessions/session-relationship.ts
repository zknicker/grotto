import type { TranscriptSessionRelationship } from '../chats/transcript-contract.ts';

export function getSessionRelationshipName(relationship: TranscriptSessionRelationship) {
    return relationship.relatedSession.name;
}

export function formatChannelRelationshipLabel(relationship: TranscriptSessionRelationship) {
    return relationship.direction === 'incoming' ? 'Spawned By' : 'Spawned Session';
}
