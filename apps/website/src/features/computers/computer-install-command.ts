const computerInstallerUrl = 'https://releases.grotto.sh/computer/install.sh';

export function buildComputerInstallCommand(serverSlug: string): string {
    return `curl -fsSL ${computerInstallerUrl} | sh -s -- /${serverSlug}`;
}
