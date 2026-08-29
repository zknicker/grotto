import {
    assertReleaseLedger,
    latestProductVersion,
    latestTargetVersion,
    releasePublishesTarget,
    releaseTargetBuildNumber,
} from './release-ledger.mjs';

const fullShaPattern = /^[0-9a-f]{40}$/u;

export function resolveReleaseSnapshot(ledger, { sourceRevision }) {
    const { latest } = assertReleaseLedger(ledger, { requireComplete: true });
    if (!fullShaPattern.test(sourceRevision ?? '')) {
        throw new Error('release snapshot source revision must be a full lowercase Git SHA');
    }

    return {
        components: {
            agent: latestTargetVersion(ledger, 'agent'),
            computer: latestTargetVersion(ledger, 'computer'),
            desktopApp: latestTargetVersion(ledger, 'app'),
            ios: latestIOSVersion(ledger),
            server: latestTargetVersion(ledger, 'server'),
        },
        date: latest.date,
        schemaVersion: 1,
        sourceRevision,
        version: latestProductVersion(ledger),
    };
}

function latestIOSVersion(ledger) {
    for (let index = ledger.length - 1; index >= 0; index -= 1) {
        if (!releasePublishesTarget(ledger[index], 'ios')) {
            continue;
        }
        return {
            buildNumber: releaseTargetBuildNumber(ledger[index]),
            version: latestTargetVersion(ledger.slice(0, index + 1), 'ios'),
        };
    }
    return null;
}
