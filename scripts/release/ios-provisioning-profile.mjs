import { createPrivateKey, sign } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export const IOS_BUNDLE_ID = 'build.grotto.ios';
export const IOS_PROVISIONING_PROFILE_NAME = 'Grotto CI App Store';

const profilesEndpoint = 'https://api.appstoreconnect.apple.com/v1/profiles';

export async function installIOSProvisioningProfile(options = {}) {
    const environment = options.environment ?? process.env;
    const fetchImpl = options.fetchImpl ?? fetch;
    const now = options.now ?? Date.now();
    const home = options.home ?? homedir();
    const credentials = readCredentials(environment);
    const token = createAppStoreConnectToken({ ...credentials, now });
    const response = await fetchImpl(profilesRequestURL(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: options.signal ?? AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
        throw new Error(`App Store Connect profiles request failed with status ${response.status}`);
    }

    const profile = selectProfile(await response.json(), now);
    const profileDirectory = path.join(
        home,
        'Library',
        'Developer',
        'Xcode',
        'UserData',
        'Provisioning Profiles'
    );
    const profilePath = path.join(profileDirectory, `${profile.uuid}.mobileprovision`);
    mkdirSync(profileDirectory, { mode: 0o700, recursive: true });
    writeFileSync(profilePath, profile.content, { mode: 0o600 });
    exposeCleanupPath(environment.GITHUB_ENV, profilePath);
    return { name: profile.name, path: profilePath, uuid: profile.uuid };
}

export function createAppStoreConnectToken({ apiKeyId, issuerId, privateKey, now = Date.now() }) {
    const issuedAt = Math.floor(now / 1000);
    const header = encodeJSON({ alg: 'ES256', kid: apiKeyId, typ: 'JWT' });
    const payload = encodeJSON({
        aud: 'appstoreconnect-v1',
        exp: issuedAt + 15 * 60,
        iat: issuedAt,
        iss: issuerId,
    });
    const signingInput = `${header}.${payload}`;
    const signature = sign('sha256', Buffer.from(signingInput), {
        dsaEncoding: 'ieee-p1363',
        key: createPrivateKey(privateKey),
    });
    return `${signingInput}.${signature.toString('base64url')}`;
}

function readCredentials(environment) {
    const apiKeyId = environment.APPLE_API_KEY_ID;
    const issuerId = environment.APPLE_API_ISSUER;
    const keyPath = environment.APPLE_API_KEY_PATH;
    if (!(apiKeyId && issuerId && keyPath)) {
        throw new Error(
            'APPLE_API_KEY_PATH, APPLE_API_KEY_ID, and APPLE_API_ISSUER are required to fetch the iOS provisioning profile'
        );
    }
    return { apiKeyId, issuerId, privateKey: readFileSync(path.resolve(keyPath), 'utf8') };
}

function profilesRequestURL() {
    const url = new URL(profilesEndpoint);
    url.searchParams.set('filter[name]', IOS_PROVISIONING_PROFILE_NAME);
    url.searchParams.set('filter[profileType]', 'IOS_APP_STORE');
    url.searchParams.set('filter[profileState]', 'ACTIVE');
    url.searchParams.set('include', 'bundleId');
    url.searchParams.set(
        'fields[profiles]',
        'name,uuid,profileContent,expirationDate,profileState,profileType,bundleId'
    );
    url.searchParams.set('fields[bundleIds]', 'identifier');
    return url;
}

function selectProfile(document, now) {
    const profiles = Array.isArray(document?.data) ? document.data : [];
    if (profiles.length !== 1) {
        throw new Error(
            `expected exactly one active ${IOS_PROVISIONING_PROFILE_NAME} profile, found ${profiles.length}`
        );
    }
    const profile = profiles[0];
    const attributes = profile?.attributes;
    if (
        attributes?.name !== IOS_PROVISIONING_PROFILE_NAME ||
        attributes?.profileType !== 'IOS_APP_STORE' ||
        attributes?.profileState !== 'ACTIVE'
    ) {
        throw new Error(
            'App Store provisioning profile does not match the requested release profile'
        );
    }
    const uuid = attributes?.uuid;
    if (!(typeof uuid === 'string' && /^[0-9A-F-]+$/iu.test(uuid))) {
        throw new Error('App Store provisioning profile has an invalid UUID');
    }
    if (!(new Date(attributes.expirationDate).getTime() > now)) {
        throw new Error('App Store provisioning profile is expired');
    }
    const bundleId = profile?.relationships?.bundleId?.data?.id;
    const includedBundle = document.included?.find(
        (entry) => entry?.type === 'bundleIds' && entry.id === bundleId
    );
    if (includedBundle?.attributes?.identifier !== IOS_BUNDLE_ID) {
        throw new Error(`App Store provisioning profile does not belong to ${IOS_BUNDLE_ID}`);
    }
    const encodedContent = attributes.profileContent;
    if (!(typeof encodedContent === 'string' && encodedContent.length > 0)) {
        throw new Error('App Store provisioning profile content is empty');
    }
    const content = Buffer.from(encodedContent, 'base64');
    if (content.length === 0) {
        throw new Error('App Store provisioning profile content is empty');
    }
    return { content, name: attributes.name, uuid };
}

function exposeCleanupPath(githubEnvironmentPath, profilePath) {
    if (!githubEnvironmentPath) {
        return;
    }
    appendFileSync(
        githubEnvironmentPath,
        `GROTTO_RELEASE_PROVISIONING_PROFILE_PATH=${profilePath}\n`,
        'utf8'
    );
}

function encodeJSON(value) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}
