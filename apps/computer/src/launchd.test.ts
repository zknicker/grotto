import { expect, test } from 'bun:test';
import { replaceLaunchdService } from './launchd.ts';

const service = {
    domain: 'gui/501',
    label: 'com.grotto.computer',
    plistPath: '/Users/test/Library/LaunchAgents/com.grotto.computer.plist',
};

test('bootstraps when bootout reports an absent service', () => {
    const calls: string[][] = [];
    const exitCodes = [5, 113, 0];

    replaceLaunchdService({
        ...service,
        run(args) {
            calls.push(args);
            return exitCodes.shift() ?? 1;
        },
    });

    expect(calls).toEqual([
        ['bootout', service.domain, service.plistPath],
        ['print', `${service.domain}/${service.label}`],
        ['bootstrap', service.domain, service.plistPath],
    ]);
});

test('fails closed when bootout leaves the service loaded', () => {
    const calls: string[][] = [];
    const exitCodes = [5, 0];

    expect(() =>
        replaceLaunchdService({
            ...service,
            run(args) {
                calls.push(args);
                return exitCodes.shift() ?? 1;
            },
        })
    ).toThrow('Could not replace Grotto Computer service.');
    expect(calls).toEqual([
        ['bootout', service.domain, service.plistPath],
        ['print', `${service.domain}/${service.label}`],
    ]);
});
