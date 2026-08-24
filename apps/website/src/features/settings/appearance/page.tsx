import { Description, Label } from '@heroui/react';
import { RadioButtonGroup } from '@heroui-pro/react';
import { type ThemePreference, useTheme } from '../../../components/theme-provider.tsx';
import { cn } from '../../../lib/utils.ts';
import { PageColumn } from '../../shell/page-column.tsx';
import { SettingsPageHeader } from '../layout/settings-page.tsx';

const themeOptions: Array<{
    description: string;
    id: ThemePreference;
    label: string;
}> = [
    { id: 'light', label: 'Light', description: 'Always use light mode' },
    { id: 'dark', label: 'Dark', description: 'Always use dark mode' },
    { id: 'system', label: 'System', description: 'Match your OS preference' },
];

export function AppearanceSettings() {
    const { setTheme, theme } = useTheme();

    return (
        <PageColumn>
            <SettingsPageHeader title="Appearance" />
            {/* Selection, keyboard navigation, focus, and the selected ring are
                the group's; the window previews below are ours. They depict a
                light and a dark window, so they stay literally light and dark in
                either theme rather than following the tokens. */}
            <RadioButtonGroup
                className="grid-cols-1 sm:grid-cols-3"
                layout="grid"
                name="theme"
                onChange={(value) => setTheme(value as ThemePreference)}
                value={theme}
            >
                <Label className="col-span-full font-medium text-foreground text-sm">
                    Theme Mode
                </Label>
                {themeOptions.map((option) => (
                    <RadioButtonGroup.Item
                        className="overflow-hidden p-0"
                        key={option.id}
                        value={option.id}
                    >
                        {/* The group parks its indicator over the artwork,
                            where a 15px dot is unreadable on a window mock;
                            it belongs on the label strip beside the name. */}
                        <RadioButtonGroup.Indicator className="top-auto right-4 bottom-4" />
                        <RadioButtonGroup.ItemContent className="gap-0">
                            <ThemePreview variant={option.id} />
                            <span className="flex flex-col gap-0.5 px-4 py-3">
                                <Label className="font-semibold text-foreground text-sm">
                                    {option.label}
                                </Label>
                                <Description className="text-muted text-sm">
                                    {option.description}
                                </Description>
                            </span>
                        </RadioButtonGroup.ItemContent>
                    </RadioButtonGroup.Item>
                ))}
            </RadioButtonGroup>
        </PageColumn>
    );
}

function ThemePreview({ variant }: { variant: ThemePreference }) {
    return (
        <span className="relative block aspect-[16/7] w-full overflow-hidden border-border border-b">
            {variant === 'system' ? <SystemSurface /> : <ToneSurface tone={variant} />}
        </span>
    );
}

function ToneSurface({ tone }: { tone: 'dark' | 'light' }) {
    return (
        <span className={cn('relative block h-full w-full', frameClass(tone))}>
            <ToneWindow tone={tone} />
        </span>
    );
}

function SystemSurface() {
    return (
        <span className="relative flex h-full w-full">
            <span className={cn('relative flex-1', frameClass('dark'))}>
                <ToneWindow insetLeft="30%" tone="dark" />
            </span>
            <span className={cn('relative flex-1', frameClass('light'))}>
                <ToneWindow insetLeft="30%" tone="light" />
            </span>
        </span>
    );
}

function ToneWindow({ insetLeft = '22%', tone }: { insetLeft?: string; tone: 'dark' | 'light' }) {
    const isDark = tone === 'dark';
    const windowSurface = isDark
        ? 'bg-zinc-950 text-white ring-1 ring-zinc-700'
        : 'bg-white text-zinc-900 ring-1 ring-zinc-300';
    const titlebar = isDark
        ? 'bg-zinc-800 border-b border-zinc-700'
        : 'bg-zinc-100 border-b border-zinc-200';

    return (
        <span
            className={cn(
                'absolute top-[18%] right-0 bottom-0 flex flex-col overflow-hidden rounded-tl-2xl',
                windowSurface
            )}
            style={{ left: insetLeft }}
        >
            <span className={cn('flex h-10 shrink-0 items-center gap-1.5 pr-3 pl-4', titlebar)}>
                <span className="size-3 rounded-full bg-[#ff5f57]" />
                <span className="size-3 rounded-full bg-[#febc2e]" />
                <span className="size-3 rounded-full bg-[#28c840]" />
            </span>
            <span className="flex flex-1 items-center justify-end pr-5">
                <span className="font-bold text-3xl tracking-tight">Aa</span>
            </span>
        </span>
    );
}

function frameClass(tone: 'dark' | 'light') {
    return tone === 'dark' ? 'bg-zinc-600' : 'bg-zinc-200';
}
