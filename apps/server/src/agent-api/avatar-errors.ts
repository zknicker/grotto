import {
    AvatarGenerationBusyError,
    AvatarGenerationProviderError,
    AvatarGenerationUnavailableError,
    AvatarImageOutputError,
} from '../avatar-generation/service.ts';
import { sendAgentApiError } from './auth.ts';

/**
 * The one avatar-generation failure vocabulary the Agent surface speaks.
 * `AVATAR_PROVIDER_UNAVAILABLE` is a deployment fact no retry changes; the
 * other three are transient and say so.
 */
export function sendAvatarGenerationFailure(
    reply: Parameters<typeof sendAgentApiError>[0],
    cause: unknown
): unknown | null {
    if (cause instanceof AvatarGenerationBusyError) {
        return sendAgentApiError(
            reply,
            429,
            'AVATAR_GENERATION_BUSY',
            'Avatar generation is at capacity. Retry shortly.',
            { nextAction: 'Retry the command once, on its own.', retryable: true }
        );
    }
    if (cause instanceof AvatarGenerationUnavailableError) {
        return sendAgentApiError(
            reply,
            503,
            'AVATAR_PROVIDER_UNAVAILABLE',
            avatarProviderUnavailableNote,
            { nextAction: avatarProviderUnavailableNextAction }
        );
    }
    if (cause instanceof AvatarGenerationProviderError) {
        return sendAgentApiError(
            reply,
            502,
            'AVATAR_PROVIDER_FAILED',
            'The image provider could not generate an avatar.',
            { nextAction: 'Retry the command once.', retryable: true }
        );
    }
    if (cause instanceof AvatarImageOutputError) {
        return sendAgentApiError(
            reply,
            502,
            'AVATAR_OUTPUT_INVALID',
            'The image provider returned an unusable avatar.',
            { nextAction: 'Retry the command once.', retryable: true }
        );
    }
    return null;
}

export const avatarProviderUnavailableNote = 'Avatar generation is not configured on this Server.';

const avatarProviderUnavailableNextAction =
    'Tell the user avatar generation is unavailable on this Server; there is no App setting to change. The Grotto deployment operator must provision it.';
