import type { IconSvgElement } from '@hugeicons/react';
import { ComputerIcon, Moon02Icon, Sun01Icon } from '@hugeicons-pro/core-duotone-rounded';
import { Tick02Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useNavigate } from 'react-router-dom';
import { type ThemePreference, useTheme } from '../../../components/theme-provider.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { appRoutes } from '../../../lib/app-routes.ts';
import { cn } from '../../../lib/utils.ts';

const themeOptions: Array<{
    description: string;
    icon: IconSvgElement;
    id: ThemePreference;
    label: string;
}> = [
    { id: 'light', label: 'Light', description: 'Always use light mode', icon: Sun01Icon },
    { id: 'dark', label: 'Dark', description: 'Always use dark mode', icon: Moon02Icon },
    { id: 'system', label: 'System', description: 'Match your OS preference', icon: ComputerIcon },
];

export function AppearanceSettings({ briefVariationsHref }: { briefVariationsHref?: string } = {}) {
    const { setTheme, theme } = useTheme();
    const navigate = useNavigate();

    return (
        <SettingsPage>
            <SettingsPageHeader title="Appearance" />
            <SettingsSection title="Theme Mode">
                <div className="grid gap-4 sm:grid-cols-3">
                    {themeOptions.map((option) => {
                        const isActive = option.id === theme;

                        return (
                            <button
                                aria-pressed={isActive}
                                className={cn(
                                    'no-drag group relative flex flex-col overflow-hidden rounded-xl border bg-surface-2 text-left outline-none',
                                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                                    isActive ? 'border-brand' : 'border-input hover:bg-accent'
                                )}
                                key={option.id}
                                onClick={() => setTheme(option.id)}
                                type="button"
                            >
                                <ThemePreview isActive={isActive} variant={option.id} />
                                <div className="flex items-center justify-between gap-2 px-4 py-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <Icon
                                            aria-hidden="true"
                                            className={cn(
                                                isActive
                                                    ? 'text-brand'
                                                    : 'text-muted-foreground group-hover:text-foreground'
                                            )}
                                            icon={option.icon}
                                            size={24}
                                        />
                                        <div className="min-w-0">
                                            <div className="truncate font-semibold text-foreground text-sm leading-none">
                                                {option.label}
                                            </div>
                                            <div className="mt-1 truncate text-meta text-muted-foreground leading-none">
                                                {option.description}
                                            </div>
                                        </div>
                                    </div>
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'inline-flex size-5 shrink-0 items-center justify-center rounded-full',
                                            isActive
                                                ? 'bg-brand text-brand-foreground'
                                                : 'border border-border bg-transparent'
                                        )}
                                    >
                                        {isActive ? (
                                            <Icon
                                                className="size-3"
                                                icon={Tick02Icon}
                                                strokeWidth={3}
                                            />
                                        ) : null}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </SettingsSection>

            <SettingsSection title="Design Lab">
                <SettingsGroup>
                    {briefVariationsHref ? (
                        <SettingsRow
                            description="Iterate on the home brief's chips, wordmark, and sentence patterns."
                            title="Brief variations"
                        >
                            <div className="flex justify-start md:justify-end">
                                <Button
                                    onClick={() => navigate(briefVariationsHref)}
                                    size="sm"
                                    variant="outline"
                                >
                                    Open
                                </Button>
                            </div>
                        </SettingsRow>
                    ) : null}
                    <SettingsRow
                        description="Every agent character across the full set of facial expressions."
                        title="Agent faces"
                    >
                        <div className="flex justify-start md:justify-end">
                            <Button
                                onClick={() => navigate(appRoutes.designFaces)}
                                size="sm"
                                variant="outline"
                            >
                                Open
                            </Button>
                        </div>
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}

function ThemePreview({ isActive, variant }: { isActive: boolean; variant: ThemePreference }) {
    return (
        <div
            className={cn(
                'relative aspect-[16/7] w-full overflow-hidden border-b',
                isActive ? 'border-brand-ring' : 'border-border'
            )}
        >
            {variant === 'system' ? <SystemSurface /> : <ToneSurface tone={variant} />}
        </div>
    );
}

function ToneSurface({ tone }: { tone: 'dark' | 'light' }) {
    return (
        <div className={cn('relative h-full w-full', frameClass(tone))}>
            <ToneWindow tone={tone} />
        </div>
    );
}

function SystemSurface() {
    return (
        <div className="relative flex h-full w-full">
            <div className={cn('relative flex-1', frameClass('dark'))}>
                <ToneWindow insetLeft="30%" tone="dark" />
            </div>
            <div className={cn('relative flex-1', frameClass('light'))}>
                <ToneWindow insetLeft="30%" tone="light" />
            </div>
        </div>
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
        <div
            className={cn(
                'absolute top-[18%] right-0 bottom-0 flex flex-col overflow-hidden rounded-tl-2xl',
                windowSurface
            )}
            style={{ left: insetLeft }}
        >
            <div className={cn('flex h-10 shrink-0 items-center gap-1.5 pr-3 pl-4', titlebar)}>
                <span className="size-3 rounded-full bg-[#ff5f57]" />
                <span className="size-3 rounded-full bg-[#febc2e]" />
                <span className="size-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex flex-1 items-center justify-end pr-5">
                <span className="font-bold text-3xl tracking-tight">Aa</span>
            </div>
        </div>
    );
}

function frameClass(tone: 'dark' | 'light') {
    return tone === 'dark' ? 'bg-zinc-600' : 'bg-zinc-200';
}
