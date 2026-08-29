import type { AvatarMediaType } from '@grotto/api/avatar';

export interface AvatarProviderRequest {
    model: 'gpt-image-2';
    numberOfImages: 1;
    outputFormat: 'png';
    prompt: string;
}

export interface AvatarImageProvider {
    /**
     * Whether this provider can generate at all (e.g. an API key is
     * configured). Surfaced to the App so it never offers generation a
     * request would immediately refuse.
     */
    readonly available: boolean;
    generate(request: AvatarProviderRequest): Promise<{
        bytes: Uint8Array;
        mediaType: AvatarMediaType;
    }>;
}

export interface AvatarGenerationLogEvent {
    actorAgentId: string;
    byteSize?: number;
    durationMs: number;
    height?: number;
    mediaType?: AvatarMediaType;
    model: 'gpt-image-2';
    outcome: 'busy' | 'output_invalid' | 'provider_failed' | 'success' | 'unavailable';
    requestId: string;
    serverId: string;
    width?: number;
}

export type AvatarGenerationLogger = (event: AvatarGenerationLogEvent) => void;
