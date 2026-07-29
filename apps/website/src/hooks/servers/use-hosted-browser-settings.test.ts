import { expect, test } from 'bun:test';
import { hostedBrowserSaveInput } from './use-hosted-browser-settings.ts';

test('Browser saves retain the selected Server and Computer route', () => {
    expect(
        hostedBrowserSaveInput(
            {
                computerId: 'cmp_selected000000',
                serverId: 'srv_selected000000',
            },
            { enabled: true, profileName: 'work' }
        )
    ).toEqual({
        computerId: 'cmp_selected000000',
        serverId: 'srv_selected000000',
        settings: { enabled: true, profileName: 'work' },
    });
});
