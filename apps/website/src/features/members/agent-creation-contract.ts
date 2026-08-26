import type { AgentReasoningEffort, ComputerInventory } from '@grotto/api';
import type { AvatarImage } from '../avatars/resize-avatar-image.ts';

export interface ReportedComputer {
    id: string;
    inventory: ComputerInventory;
    label: string;
}

export interface AgentCreationInitialValues {
    avatarUrl: string | null;
    computerId?: string;
    description: string | null;
    displayName: string;
    modelId?: string;
    reasoningEffort?: AgentReasoningEffort;
    runtimeId?: string;
}

export interface AgentCreationSubmitValues {
    avatar?: {
        bytesBase64: string;
        mediaType: AvatarImage['mediaType'];
    };
    computerId: string;
    description: string | null;
    displayName: string;
    handle: string;
    modelId: string;
    reasoningEffort: AgentReasoningEffort;
    runtimeId: string;
}
