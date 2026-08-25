const publishableKeyEnvironmentName = 'VITE_CLERK_PUBLISHABLE_KEY';

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
    if (configured) {
        return configured;
    }

    throw new Error(
        `${publishableKeyEnvironmentName} is required. Run the release under \`varlock run\` so it resolves from .env.schema.`
    );
}
