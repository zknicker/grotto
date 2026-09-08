import type { CloudAgentWork, ThreadCloudAgentWork } from '@grotto/api';

/** Stable creation order keeps the carousel from moving when a Run settles. */
export function indexCloudAgentWorkByThreadAnchor(
    rows: readonly ThreadCloudAgentWork[] | undefined
): ReadonlyMap<string, readonly CloudAgentWork[]> {
    const byAnchor = new Map<string, CloudAgentWork[]>();
    for (const { anchorMessageId, work } of rows ?? []) {
        const works = byAnchor.get(anchorMessageId) ?? [];
        works.push(work);
        byAnchor.set(anchorMessageId, works);
    }
    return byAnchor;
}
