#!/usr/bin/env node

import { fail, readJson } from './release-utils.mjs';
import { syncReleaseVersionMetadata } from './release-version-metadata.mjs';

try {
    const metadata = await syncReleaseVersionMetadata(await readJson('releases.json'));
    console.log('Synchronized release versions from releases.json:');
    console.log(`- Grotto: ${metadata.product}`);
    console.log(`- Server: ${metadata.server ?? 'unversioned'}`);
    console.log(`- App: ${metadata.app ?? 'unversioned'}`);
    console.log(`- Computer: ${metadata.computer ?? 'unversioned'}`);
    console.log(`- Grotto Agent: ${metadata.agent ?? 'unversioned'}`);
    console.log(
        `- iOS: ${metadata.ios ? `${metadata.ios.version} (${metadata.ios.buildNumber})` : 'unversioned'}`
    );
} catch (error) {
    fail(error instanceof Error ? error.message : String(error));
}
