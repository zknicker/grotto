const publishableKeyEnvironmentName = 'VITE_CLERK_PUBLISHABLE_KEY';
const releaseSwitchName = 'GROTTO_RESOLVE_RELEASE_TOKENS';
const productionKeyPrefix = 'pk_live_';

/**
 * The Grotto App bundle inlines the Clerk publishable key at build time. It is
 * a public value with one owner: the committed `.env.schema`, which carries the
 * production literal. Release commands run under `varlock run`, so it is always
 * present — the throw exists to catch a release started outside varlock rather
 * than to shop for the value somewhere else.
 */
export function loadAppReleaseEnvironment(options = {}) {
    const environment = options.environment ?? process.env;
    const configured = environment[publishableKeyEnvironmentName]?.trim();
    if (!configured) {
        throw new Error(
            `${publishableKeyEnvironmentName} is required. Run the release under \`varlock run\` so it resolves from .env.schema.`
        );
    }

    assertReleasePublishableKey(environment);
    return configured;
}

/**
 * Inverted guard on the one build input that reaches every signed-in human. A
 * publishable key names its Clerk instance in its own prefix, so a development
 * key is structurally recognisable: `pk_test_` must never reach an artifact
 * users run, whatever the schema or the operator's shell resolved.
 *
 * Keyed on the release switch rather than the lifecycle because a release
 * resolves the development lifecycle by design (the production 1Password
 * instance refuses desktop authorization), so the lifecycle cannot answer
 * "is this a shippable artifact?" — the switch is what does.
 */
export function assertReleasePublishableKey(environment = process.env) {
    if (environment[releaseSwitchName] !== 'true') {
        return;
    }

    const configured = environment[publishableKeyEnvironmentName]?.trim() ?? '';
    if (configured.startsWith(productionKeyPrefix)) {
        return;
    }

    // Name the instance prefix, never the whole key: the prefix is the entire
    // diagnosis, and it keeps the failure readable mid-release.
    const resolved = configured
        ? `a "${configured.split('_').slice(0, 2).join('_')}_" key`
        : 'nothing';
    throw new Error(
        `${publishableKeyEnvironmentName} must be a ${productionKeyPrefix} key in a release build, but resolved ${resolved}. Refusing to ship a non-production Clerk instance.`
    );
}
