const computerInstallerUrl = 'https://releases.haus.chat/computer/install.sh';

export interface ComputerSetupCommands {
    install: string;
    setup: string;
}

export function buildComputerSetupCommands(serverSlug: string): ComputerSetupCommands {
    return {
        install: `curl -fsSL ${computerInstallerUrl} | sh`,
        setup: `$HOME/.local/bin/haus-computer setup /${serverSlug}`,
    };
}
