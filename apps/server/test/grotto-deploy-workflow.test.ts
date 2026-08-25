import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const workflowPath = join(repoRoot, '.github/workflows/deploy-grotto-server.yml');

test('promotes a published Grotto version only on an explicit dispatch', () => {
    const source = readFileSync(workflowPath, 'utf8');
    const workflow = parse(source) as {
        concurrency: { 'cancel-in-progress': boolean; group: string };
        jobs: {
            deploy: {
                env: Record<string, string>;
                permissions: { contents: string };
                steps: {
                    'continue-on-error'?: boolean;
                    env?: Record<string, string>;
                    if?: string;
                    name?: string;
                    run?: string;
                    uses?: string;
                    with?: Record<string, unknown>;
                }[];
                'runs-on': string[];
            };
        };
        on: {
            workflow_dispatch: {
                inputs: {
                    mode: { options: string[]; required: boolean; type: string };
                    version: { required: boolean; type: string };
                };
            };
        };
    };

    // Publishing a Release no longer deploys. A deploy resolves production
    // credentials from 1Password and rewrites the Server's delivered
    // environment, so it is an explicit act.
    expect(workflow.on).toEqual({
        workflow_dispatch: {
            inputs: {
                mode: {
                    description: 'Production action',
                    options: ['deploy', 'activate'],
                    required: true,
                    type: 'choice',
                },
                version: {
                    description: 'Published Grotto version (vX.Y.Z)',
                    required: true,
                    type: 'string',
                },
            },
        },
    });
    expect(workflow.concurrency).toEqual({
        'cancel-in-progress': false,
        group: 'grotto-production',
    });

    const job = workflow.jobs.deploy;
    const commands = job.steps.flatMap((step) => step.run ?? []).join('\n');
    const resolveCommands =
        job.steps.find((step) => step.name === 'Resolve published version')?.run ?? '';
    const deployCommands =
        job.steps.find((step) => step.name === 'Deploy downloaded release')?.run ?? '';
    const verifyCommands =
        job.steps.find((step) => step.name === 'Verify installed release')?.run ?? '';
    const migrationStep = job.steps.find((step) => step.name === 'Apply database migrations');
    const renderStep = job.steps.find((step) => step.name === 'Render the Server environment');
    const checkoutStep = job.steps.find((step) => step.name === 'Check out the released revision');
    expect(job['runs-on']).toEqual(['self-hosted', 'grotto']);
    expect(job.permissions).toEqual({ contents: 'read' });
    expect(source).toContain('/Users/zknicker/srv/grotto');
    expect(commands).toContain('.published_at');
    expect(commands).toContain('/git/ref/tags/');
    expect(commands).toContain('/git/tags/');
    expect(resolveCommands).not.toContain('/releases/assets/');
    expect(resolveCommands).not.toContain('grotto-server-');
    expect(deployCommands).toContain('/releases/assets/');
    expect(deployCommands).toContain('application/octet-stream');
    expect(deployCommands).toContain('/usr/bin/shasum -a 256 -c');
    expect(deployCommands).toContain('./bin/grotto-server-deploy');
    expect(deployCommands).toContain('/bin/grotto-server-deploy');
    expect(verifyCommands).not.toContain('/releases/assets/');
    expect(verifyCommands).not.toContain('grotto-server-');
    const installedReleasePath = [
        '$',
        '{GROTTO_DEPLOY_ROOT}/releases/',
        '$',
        '{GROTTO_SOURCE_REVISION}',
    ].join('');
    expect(verifyCommands).toContain(installedReleasePath);

    // The environment contract travels with the release: the workspace is
    // checked out at the exact revision the artifact was built from, so
    // .env.schema always matches the Server about to run.
    expect(checkoutStep?.uses).toBe('actions/checkout@v4');
    expect(checkoutStep?.with?.ref).toBe(['$', '{{ env.GROTTO_SOURCE_REVISION }}'].join(''));

    // Every production value resolves from the schema. The only platform-held
    // secret is the deploy agent's bootstrap token, and it fills the schema's
    // production role slot rather than naming a credential.
    for (const step of [renderStep, migrationStep]) {
        expect(step?.env?.VARLOCK_ENV).toBe('production');
        expect(step?.env?.DEPLOY_AGENT_PRODUCTION_OP_TOKEN).toContain(
            'secrets.GH_DEPLOY_AGENT_PRODUCTION_OP_TOKEN'
        );
    }
    expect(renderStep?.run).toContain('bun scripts/render-server-env.ts');
    expect(migrationStep?.run).toContain('/bin/grotto-server-migrate');
    expect(migrationStep?.run).toContain('Database: ✅');
    expect(migrationStep?.run).toContain('release was not activated');

    // The migration credential is no longer a repository secret, and the deploy
    // agent's bootstrap token is the only one that remains.
    expect(source).not.toContain('secrets.GROTTO_DATABASE_MIGRATION_URL');
    const workflowSecrets = new Set(
        [...source.matchAll(/secrets\.([A-Z][A-Z0-9_]*)/gu)].map((match) => match[1])
    );
    expect([...workflowSecrets]).toEqual(['GH_DEPLOY_AGENT_PRODUCTION_OP_TOKEN']);

    // Render, then migrate, then activate.
    expect(commands.indexOf('render-server-env')).toBeLessThan(
        commands.indexOf('/bin/grotto-server-migrate')
    );
    expect(commands.indexOf('/bin/grotto-server-migrate')).toBeLessThan(
        commands.indexOf('/usr/local/libexec/grotto/activate-grotto-server')
    );
    expect(commands).toContain('/usr/bin/sudo -n /usr/local/libexec/grotto/activate-grotto-server');
    expect(deployCommands.indexOf('/usr/bin/shasum -a 256 -c')).toBeLessThan(
        deployCommands.indexOf('./bin/grotto-server-deploy')
    );
    expect(commands).toContain("trap 'cleanup' EXIT");
    expect(commands).toContain('/usr/bin/trash');
    expect(commands).not.toContain('git fetch');
    expect(commands).not.toContain('git reset');
    expect(commands).not.toContain('git clean');
    expect(commands).not.toContain('release:check');
    expect(commands).not.toContain('VITE_CLERK_PUBLISHABLE_KEY');
    expect(commands).not.toContain('--env-file');
    expect(commands).not.toContain('bootstrap:grotto');
    expect(commands).not.toContain('migration.env');
    expect(commands).not.toContain('docker compose down');

    // A stray .env is loaded above the schema and a `$` in one of its values is
    // parsed as an expression; the deploy refuses to run with either present.
    expect(commands).toContain('the schema is the only source of production values');

    expect(job.steps.find((step) => step.name === 'Deploy downloaded release')?.if).toBe(
        "env.GROTTO_RELEASE_MODE == 'deploy'"
    );
    expect(job.steps.find((step) => step.name === 'Verify installed release')?.if).toBe(
        "env.GROTTO_RELEASE_MODE == 'activate'"
    );
    // Proving the delivered environment is the last thing the deploy does.
    expect(job.steps.at(-1)?.name).toBe('Verify the delivered environment');
    expect(job.steps.at(-1)?.run).toContain('verify-deployed-secrets.ts');
    // No notification step: it read two repository secrets that never existed,
    // so it could only ever have been a silent no-op.
    expect(source).not.toContain('deploy-notify');
});

test('documents version publication as the only production promotion', () => {
    const releaseDocs = readFileSync(join(repoRoot, 'docs/operations/releases.md'), 'utf8');
    const deployDocs = readFileSync(
        join(repoRoot, 'docs/operations/grotto-server-deploy.md'),
        'utf8'
    );

    expect(releaseDocs).toContain('A push to `main` does not');
    expect(releaseDocs).toContain('one atomic production artifact with one Server SemVer');
    expect(releaseDocs).toContain('`activate`: verify and switch');
    expect(deployDocs).toContain('/Users/zknicker/srv/grotto');
    expect(deployDocs).toContain('never run `git clean`');
    expect(deployDocs).toContain('Grotto production `GROTTO_CLERK_SECRET_KEY`');
    expect(deployDocs).not.toContain('/opt/grotto-server');
});
