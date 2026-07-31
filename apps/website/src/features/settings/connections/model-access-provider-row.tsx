import { FieldError } from '@heroui/react';
import type { IconSvgElement } from '@hugeicons/react';
import type { ReactNode } from 'react';
import {
    ModelProviderLogo,
    type ModelProviderLogoSource,
} from '../../../components/badges/model-provider-logo.tsx';
import type { ModelAccessOutput } from '../../../lib/trpc.tsx';
import { SettingsItem } from '../layout/settings-page.tsx';
import {
    ProviderConnectionDescription,
    ProviderConnectionDetail,
    ProviderConnectionStatus,
} from './provider-connection-description.tsx';

interface ModelAccessProviderRowProps {
    children?: ReactNode;
    color: string;
    description: string;
    descriptionPlacement?: 'left' | 'right';
    error?: string | null;
    icon: IconSvgElement;
    label: string;
    logo?: ModelProviderLogoSource | null;
    state: ModelAccessOutput['providers'][number]['state'];
    target?: 'secure-storage';
}

export function ModelAccessProviderRow({
    children,
    color,
    description,
    descriptionPlacement = 'left',
    error = null,
    icon,
    label,
    logo,
    state,
    target,
}: ModelAccessProviderRowProps) {
    const hasDetail = descriptionPlacement === 'right';
    const hasSideContent = hasDetail || Boolean(children) || Boolean(error);

    return (
        <SettingsItem className="grid gap-3 md:grid-cols-[minmax(10rem,1fr)_minmax(16rem,17rem)] md:items-center md:gap-6">
            <div className="flex min-w-0 items-center gap-3">
                <ModelProviderLogo
                    className="size-10 rounded-xl"
                    color={color}
                    fallbackIcon={icon}
                    iconClassName="size-5"
                    logo={logo}
                />
                <div className="min-w-0 space-y-0.5">
                    <h3 className="truncate font-medium text-foreground text-sm">{label}</h3>
                    {descriptionPlacement === 'left' ? (
                        <ProviderConnectionDescription
                            description={description}
                            state={state}
                            target={target}
                        />
                    ) : (
                        <ProviderConnectionStatus state={state} />
                    )}
                </div>
            </div>

            {hasSideContent ? (
                <div className="min-w-0 space-y-2 md:w-full md:justify-self-end">
                    {hasDetail ? (
                        <div className="md:text-right">
                            <ProviderConnectionDetail
                                description={description}
                                state={state}
                                target={target}
                            />
                        </div>
                    ) : null}
                    {children ? (
                        <div className="flex justify-start gap-2 md:justify-end">{children}</div>
                    ) : null}
                    {error ? <FieldError>{error}</FieldError> : null}
                </div>
            ) : null}
        </SettingsItem>
    );
}
