import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const workflowPath = join(repoRoot, '.github/workflows/deploy-grotto-server.yml');

test('promotes only published Grotto versions or an explicit published-version command', () => {
    const source = readFileSync(workflowPath, 'utf8');
    const workflow = parse(source) as {
        concurrency: { 'cancel-in-progress': boolean; group: string };
        jobs: {
            deploy: {
                if: string;
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
            release: { types: string[] };
            workflow_dispatch: {
                inputs: {
                    mode: { options: string[]; required: boolean; type: string };
                    version: { required: boolean; type: string };
                };
            };
        };
    };

    expect(workflow.on).toEqual({
        release: { types: ['published'] },
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
    expect(job['runs-on']).toEqual(['self-hosted', 'grotto']);
    expect(job.if).toBe(
        "github.event_name != 'release' || startsWith(github.event.release.tag_name, 'v')"
    );
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
    expect(migrationStep?.env).toMatchObject({
        GROTTO_DATABASE_BACKUP_ROLE: 'grotto_backup',
        GROTTO_DATABASE_RUNTIME_ROLE: 'grotto_runtime',
    });
    expect(migrationStep?.env?.GROTTO_DATABASE_MIGRATION_URL).toContain(
        'secrets.GROTTO_DATABASE_MIGRATION_URL'
    );
    expect(migrationStep?.run).toContain('/bin/grotto-server-migrate');
    expect(migrationStep?.run).toContain(
        ['[[ -n "$', '{GROTTO_DATABASE_MIGRATION_URL}" ]]'].join('')
    );
    expect(migrationStep?.run).toContain('Database: ✅');
    expect(migrationStep?.run).toContain('release was not activated');
    expect(commands.indexOf('/bin/grotto-server-migrate')).toBeLessThan(
        commands.indexOf('/usr/local/libexec/grotto/activate-grotto-server')
    );
    expect(commands).toContain('/usr/bin/sudo -n /usr/local/libexec/grotto/activate-grotto-server');
    expect(deployCommands.indexOf('/usr/bin/shasum -a 256 -c')).toBeLessThan(
        deployCommands.indexOf('./bin/grotto-server-deploy')
    );
    expect(commands).toContain("trap 'cleanup' EXIT");
    expect(commands).toContain('/usr/bin/trash');
    expect(commands).not.toContain('bun');
    expect(commands).not.toContain('git fetch');
    expect(commands).not.toContain('git reset');
    expect(commands).not.toContain('git rev-parse');
    expect(commands).not.toContain('git clean');
    expect(commands).not.toContain('release:check');
    expect(commands).not.toContain('VITE_CLERK_PUBLISHABLE_KEY');
    expect(commands).not.toContain('--env-file');
    expect(commands).not.toContain('bootstrap:grotto');
    expect(commands).not.toContain('migration.env');
    expect(commands).not.toContain('docker compose up');
    expect(commands).not.toContain('docker compose down');

    expect(job.steps.find((step) => step.name === 'Deploy downloaded release')?.if).toBe(
        "env.GROTTO_RELEASE_MODE == 'deploy'"
    );
    expect(job.steps.find((step) => step.name === 'Verify installed release')?.if).toBe(
        "env.GROTTO_RELEASE_MODE == 'activate'"
    );
    expect(job.steps.at(-1)).toMatchObject({
        'continue-on-error': true,
        uses: 'merchbaseco/captainhook/.github/actions/deploy-notify@v1',
    });
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
    expect(deployDocs).toContain('Grotto production `CLERK_SECRET_KEY`');
    expect(deployDocs).not.toContain('/opt/grotto-server');
});
