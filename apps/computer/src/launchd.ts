export function replaceLaunchdService(input: {
    domain: string;
    label: string;
    plistPath: string;
    run(args: string[]): number;
}) {
    const bootoutExitCode = input.run(['bootout', input.domain, input.plistPath]);
    if (bootoutExitCode !== 0 && input.run(['print', `${input.domain}/${input.label}`]) === 0) {
        throw new Error('Could not replace Grotto Computer service.');
    }
    if (input.run(['bootstrap', input.domain, input.plistPath]) !== 0) {
        throw new Error('Could not start Grotto Computer service.');
    }
}
