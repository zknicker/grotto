import { expect, test } from 'bun:test';
import { buildComputerSetupCommands } from './computer-install-command.ts';

test('builds separate install and Server setup commands', () => {
    expect(buildComputerSetupCommands('grotto-hq')).toEqual({
        install: 'curl -fsSL https://releases.grotto.sh/computer/install.sh | sh',
        setup: '$HOME/.local/bin/grotto-computer setup /grotto-hq',
    });
});
