import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

test('builds one versioned Apple Silicon Server artifact with App and operations assets', async () => {
    const websitePackage = JSON.parse(
        readFileSync(join(repoRoot, 'apps/website/package.json'), 'utf8')
    ) as { version: string };
    const artifact = join(
        repoRoot,
        'apps/server/release',
        `grotto-server-${websitePackage.version}-aarch64-apple-darwin.tar.gz`
    );
    const build = Bun.spawn(
        [Bun.which('bun') ?? 'bun', 'scripts/build-grotto-server-artifact.mjs'],
        {
            cwd: repoRoot,
            env: {
                ...process.env,
                VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_ZXhhbXBsZS5jb20k',
            },
            stderr: 'pipe',
            stdout: 'pipe',
        }
    );
    const [exitCode, stderr] = await Promise.all([build.exited, new Response(build.stderr).text()]);
    if (exitCode !== 0) {
        throw new Error(`Artifact build failed: ${stderr}`);
    }

    const archive = Bun.spawnSync(['/usr/bin/tar', '-tzf', artifact], {
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const verboseArchive = Bun.spawnSync(['/usr/bin/tar', '-tvzf', artifact], {
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const paths = archive.stdout.toString();
    expect(archive.exitCode).toBe(0);
    expect(verboseArchive.exitCode).toBe(0);
    expect(paths).toContain('./bin/grotto-server');
    expect(paths).toContain('./bin/grotto-server-bootstrap');
    expect(paths).toContain('./bin/grotto-server-backup');
    expect(paths).toContain('./bin/grotto-server-restore');
    expect(paths).toContain('./bin/grotto-server-monitor');
    expect(paths).toContain('./share/grotto-server/app/index.html');
    expect(paths).toContain('./compose.yml');
    expect(paths).toContain('./colima/com.merchbaseco.colima-autostart.plist');
    expect(paths).toContain('./launchd/com.grotto.server.plist');
    expect(paths).toContain('./launchd/com.grotto.tunnel.plist');
    expect(paths).toContain('./launchd/com.grotto.backup.plist');
    expect(paths).toContain('./launchd/com.grotto.monitor.plist');
    expect(paths).not.toContain('./launchd/com.grotto.postgresql.plist');
    expect(paths).toContain('./operations/install-colima-boot');
    expect(paths).toContain('./operations/launchctl-service-disabled');
    expect(paths).toContain('./operations/rollback-colima-boot');
    expect(paths).toContain('./operations/run-server');
    expect(paths).toContain('./operations/run-restore');
    expect(paths).toContain('./config/server.env.example');
    expect(paths).toContain('./config/restore.env.example');
    expect(paths).toContain('./config/cloudflared.yml.example');
    expect(verboseArchive.stdout.toString()).toMatch(
        /-rwxr-xr-x .* \.\/operations\/install-colima-boot/u
    );
    expect(verboseArchive.stdout.toString()).toMatch(
        /-rwxr-xr-x .* \.\/operations\/rollback-colima-boot/u
    );
}, 120_000);

test('refuses to build an App that cannot sign in', async () => {
    const build = Bun.spawn(
        [Bun.which('bun') ?? 'bun', 'scripts/build-grotto-server-artifact.mjs'],
        {
            cwd: repoRoot,
            env: {
                ...process.env,
                VITE_CLERK_PUBLISHABLE_KEY: '',
            },
            stderr: 'pipe',
            stdout: 'pipe',
        }
    );
    const [exitCode, stderr] = await Promise.all([build.exited, new Response(build.stderr).text()]);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('VITE_CLERK_PUBLISHABLE_KEY');
}, 120_000);
