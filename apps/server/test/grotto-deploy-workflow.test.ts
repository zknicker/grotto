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
                permissions: { contents: string };
                steps: { run?: string; uses?: string; with?: Record<string, unknown> }[];
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
    expect(job['runs-on']).toEqual(['self-hosted', 'grotto']);
    expect(job.permissions).toEqual({ contents: 'read' });
    expect(source).toContain('/Users/zknicker/srv/grotto');
    expect(commands).toContain('refs/tags/');
    expect(commands).toContain('.published_at');
    expect(commands).toContain('git cat-file -t');
    expect(commands).toContain('git reset --hard');
    expect(commands).toContain('git rev-parse HEAD');
    expect(commands).toContain('bun --no-env-file install --frozen-lockfile');
    expect(commands).toContain('bun --no-env-file run release:check');
    expect(commands).toContain('deploy:grotto-server');
    expect(commands).toContain('bun --no-env-file run deploy:grotto-server');
    expect(commands).toContain('/usr/bin/sudo -n /usr/local/libexec/grotto/activate-grotto-server');
    expect(commands).not.toContain('git clean');
    expect(commands).not.toContain('bootstrap:grotto');
    expect(commands).not.toContain('migration');
    expect(commands).not.toContain('docker compose up');
    expect(commands).not.toContain('docker compose down');

    expect(job.steps.at(-1)).toMatchObject({
        uses: 'merchbaseco/captainhook/.github/actions/deploy-notify@v1',
    });
});

test('documents version publication as the only hosted production promotion', () => {
    const releaseDocs = readFileSync(join(repoRoot, 'docs/operations/releases.md'), 'utf8');
    const deployDocs = readFileSync(
        join(repoRoot, 'docs/operations/grotto-server-deploy.md'),
        'utf8'
    );

    expect(releaseDocs).toContain('A push to `main` does not');
    expect(releaseDocs).toContain('there is no separate\nServer SemVer');
    expect(releaseDocs).toContain('`activate`: verify and switch');
    expect(deployDocs).toContain('/Users/zknicker/srv/grotto');
    expect(deployDocs).toContain('never run `git clean`');
    expect(deployDocs).toContain('Grotto production `CLERK_SECRET_KEY`');
    expect(deployDocs).not.toContain('/opt/grotto-server');
});
