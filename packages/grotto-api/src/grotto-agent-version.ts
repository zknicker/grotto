import manifest from '../grotto-agent.json' with { type: 'json' };

const semverPattern = /^\d+\.\d+\.\d+$/u;

if (!semverPattern.test(manifest.version)) {
    throw new Error('Grotto Agent version must be exact SemVer.');
}

export const grottoAgentVersion = manifest.version;
