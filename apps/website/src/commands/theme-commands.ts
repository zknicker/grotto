import { ComputerIcon, MoonIcon, Sun01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { ThemePreference } from '../components/theme-provider.tsx';
import type { AppCommandGroup } from './types.ts';

export function buildThemeCommandGroup(
    setTheme: (theme: ThemePreference) => void
): AppCommandGroup {
    return {
        id: 'appearance',
        title: 'Appearance',
        commands: (
            [
                { value: 'light', title: 'Use Light Theme', icon: Sun01Icon },
                { value: 'dark', title: 'Use Dark Theme', icon: MoonIcon },
                { value: 'system', title: 'Use System Theme', icon: ComputerIcon },
            ] as const
        ).map(({ value, title, icon }) => ({
            id: `theme.${value}`,
            title,
            icon,
            keywords: ['appearance', 'theme', 'color', 'mode', value],
            run: () => setTheme(value),
        })),
    };
}
