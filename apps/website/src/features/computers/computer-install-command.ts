const computerInstallerUrl = 'https://releases.grotto.sh/computer/install.sh';

export interface ComputerSetupCommands {
    install: string;
    setup: string;
}

export function buildComputerSetupCommands(serverSlug: string): ComputerSetupCommands {
    return {
        install: `curl -fsSL ${computerInstallerUrl} | sh`,
        setup: `$HOME/.local/bin/grotto-computer setup /${serverSlug}`,
    };
}
