import { createClaudeCode } from '@ai-sdk/harness-claude-code';
import { ClaudeUsageAuthError, loadClaudeCredentials } from '@haus/claude-usage';

type ClaudeSettings = Pick<
    NonNullable<Parameters<typeof createClaudeCode>[0]>,
    'model' | 'effort' | 'maxTurns'
>;

/** Resolve the host login at each native start, keeping Agent homes isolated. */
export function createComputerClaudeCode(settings: ClaudeSettings) {
    return {
        ...createClaudeCode(settings),
        doStart: async (options: Parameters<ReturnType<typeof createClaudeCode>['doStart']>[0]) => {
            const env = await claudeNativeEnvironment();
            const sandbox = options.sandboxSession;
            // The bridge persists turn settings; credentials belong only in its process environment.
            const spawn: typeof sandbox.spawn = (command) =>
                sandbox.spawn({ ...command, env: { ...command.env, ...env } });
            return createClaudeCode({ ...settings, auth: 'direct' }).doStart({
                ...options,
                sandboxSession: {
                    ...sandbox,
                    spawn,
                    ...('restricted' in sandbox
                        ? { restricted: () => ({ ...sandbox.restricted(), spawn }) }
                        : {}),
                },
            });
        },
    };
}

export async function claudeNativeEnvironment(
    options: {
        environment?: NodeJS.ProcessEnv;
        loadCredentials?: typeof loadClaudeCredentials;
    } = {}
): Promise<Record<string, string>> {
    const environment = options.environment ?? process.env;
    if (
        environment.ANTHROPIC_API_KEY ||
        environment.ANTHROPIC_AUTH_TOKEN ||
        environment.CLAUDE_CODE_OAUTH_TOKEN
    ) {
        return {};
    }
    const loaded = await (options.loadCredentials ?? loadClaudeCredentials)({ environment });
    if (!loaded) {
        throw new ClaudeUsageAuthError(
            'Claude Code authentication required. Sign in to Claude Code on this Computer, then retry the Agent.'
        );
    }
    return { CLAUDE_CODE_OAUTH_TOKEN: loaded.credentials.accessToken };
}
