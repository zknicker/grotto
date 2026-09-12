import manifest from '../haus-agent.json' with { type: 'json' };

const semverPattern = /^\d+\.\d+\.\d+$/u;

if (!semverPattern.test(manifest.version)) {
    throw new Error('Haus Agent version must be exact SemVer.');
}

export const hausAgentVersion = manifest.version;
