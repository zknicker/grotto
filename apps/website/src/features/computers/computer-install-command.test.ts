import { expect, test } from 'bun:test';
import { buildComputerInstallCommand } from './computer-install-command.ts';

test('builds the standalone install-and-setup command for one Server', () => {
    expect(buildComputerInstallCommand('grotto-hq')).toBe(
        'curl -fsSL https://releases.grotto.sh/computer/install.sh | sh -s -- /grotto-hq'
    );
});
