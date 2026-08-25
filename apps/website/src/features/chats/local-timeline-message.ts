const localTimelineMessageMetadataKey = '__grottoLocalTimelineMessage';

export function isLocalTimelineMessageMetadata(
    metadata: Record<string, unknown> | null | undefined
) {
    return metadata?.[localTimelineMessageMetadataKey] === true;
}

export function withLocalTimelineMessageMetadata(metadata?: Record<string, unknown>) {
    return {
        ...(metadata ?? {}),
        [localTimelineMessageMetadataKey]: true,
    };
}
