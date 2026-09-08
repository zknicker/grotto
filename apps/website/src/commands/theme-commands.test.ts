import { expect, test } from 'bun:test';
import type { ThemePreference } from '../components/theme-provider.tsx';
import { buildThemeCommandGroup } from './theme-commands.ts';
import { getCommandSearchText } from './types.ts';

test('theme commands are searchable and apply each existing preference', async () => {
    const preferences: ThemePreference[] = [];
    const group = buildThemeCommandGroup((theme) => {
        preferences.push(theme);
    });
    expect(group.commands.map((command) => command.id)).toEqual([
        'theme.light',
        'theme.dark',
        'theme.system',
    ]);
    for (const command of group.commands) {
        expect(getCommandSearchText(command).toLowerCase()).toContain('theme');
        expect(getCommandSearchText(command).toLowerCase()).toContain(
            command.id.split('.')[1] ?? ''
        );
        await command.run();
    }
    expect(preferences).toEqual(['light', 'dark', 'system']);
});
