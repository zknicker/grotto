import { Button, Popover, SearchField } from '@heroui/react';
import { Plus } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { ModelProviderLogo } from '../../../components/badges/model-provider-logo.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { getModelProviderConfig } from '../../../lib/model-provider-config.ts';
import type { ModelInventoryOutput } from '../../../lib/trpc.tsx';

type ModelInventoryProvider = ModelInventoryOutput['providers'][number];
type ModelProviderApiKeyOption = ModelInventoryOutput['apiKeyOptions'][number];

interface ProviderCatalogPopoverProps {
    apiKeyOptions: ModelProviderApiKeyOption[];
    disabled: boolean;
    error: string | null;
    onAddKey: (option: ModelProviderApiKeyOption) => void;
    onShowInstructions: (provider: ModelInventoryProvider) => void;
    onStartOAuth: (provider: ModelInventoryProvider, close: () => void) => void;
    pendingProviderId: string | null;
    providers: ModelInventoryProvider[];
    showIcon?: boolean;
}

export function ProviderCatalogPopover({
    apiKeyOptions,
    disabled,
    error,
    onAddKey,
    onShowInstructions,
    onStartOAuth,
    pendingProviderId,
    providers,
    showIcon = true,
}: ProviderCatalogPopoverProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const close = React.useCallback(() => setOpen(false), []);

    React.useEffect(() => {
        if (open) {
            setQuery('');
        }
    }, [open]);

    const providerItems = React.useMemo(
        () => createProviderSetupItems(providers, apiKeyOptions),
        [apiKeyOptions, providers]
    );
    const visibleItems = React.useMemo(
        () => filterProviderItems(providerItems, query),
        [providerItems, query]
    );

    return (
        <Popover isOpen={open} onOpenChange={setOpen}>
            <Button isDisabled={disabled} type="button" variant="secondary">
                {showIcon ? <Icon aria-hidden="true" icon={Plus} /> : null}
                Add Provider
            </Button>
            <Popover.Content offset={8} placement="bottom end">
                <Popover.Dialog>
                    <div className="w-[min(31rem,calc(100vw-4rem))] p-2">
                        <div className="sticky top-0 z-10 bg-overlay pb-2">
                            <SearchField
                                aria-label="Search providers"
                                fullWidth
                                name="provider-search"
                                onChange={setQuery}
                                value={query}
                                variant="secondary"
                            >
                                <SearchField.Group>
                                    <SearchField.SearchIcon />
                                    <SearchField.Input placeholder="Search Providers…" />
                                    <SearchField.ClearButton />
                                </SearchField.Group>
                            </SearchField>
                        </div>

                        <div className="max-h-[min(22rem,calc(100dvh-10rem))] overflow-y-auto">
                            {visibleItems.length > 0 ? (
                                <ul className="divide-y divide-separator">
                                    {visibleItems.map((item) => (
                                        <ProviderCatalogRow
                                            close={close}
                                            item={item}
                                            key={item.id}
                                            onAddKey={onAddKey}
                                            onShowInstructions={onShowInstructions}
                                            onStartOAuth={onStartOAuth}
                                            pending={
                                                item.provider
                                                    ? pendingProviderId === item.provider.provider
                                                    : false
                                            }
                                        />
                                    ))}
                                </ul>
                            ) : (
                                <div className="py-8 text-center text-muted text-sm">
                                    No providers match that search.
                                </div>
                            )}

                            {error ? (
                                <div className="border-separator border-t px-3 py-2 text-danger text-sm">
                                    {error}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </Popover.Dialog>
            </Popover.Content>
        </Popover>
    );
}

function ProviderCatalogRow({
    close,
    item,
    onAddKey,
    onShowInstructions,
    onStartOAuth,
    pending,
}: {
    close: () => void;
    item: ProviderSetupItem;
    onAddKey: (option: ModelProviderApiKeyOption) => void;
    onShowInstructions: (provider: ModelInventoryProvider) => void;
    onStartOAuth: (provider: ModelInventoryProvider, close: () => void) => void;
    pending: boolean;
}) {
    const providerConfig = getModelProviderConfig(item.providerId);

    return (
        <li>
            <button
                aria-label={`Add ${item.displayName}`}
                className="flex min-h-12 w-full cursor-(--cursor-interactive) items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default disabled:opacity-64"
                disabled={pending}
                onClick={() =>
                    performProviderSetupAction(item, {
                        close,
                        onAddKey,
                        onShowInstructions,
                        onStartOAuth,
                    })
                }
                type="button"
            >
                <ModelProviderLogo
                    className="size-8 rounded-lg"
                    color={providerConfig.color}
                    fallbackIcon={providerConfig.icon}
                    iconClassName="size-4.5"
                    logo={providerConfig.logo}
                />
                <h3 className="truncate font-medium text-foreground text-sm">{item.displayName}</h3>
            </button>
        </li>
    );
}

function performProviderSetupAction(
    item: ProviderSetupItem,
    handlers: {
        close: () => void;
        onAddKey: (option: ModelProviderApiKeyOption) => void;
        onShowInstructions: (provider: ModelInventoryProvider) => void;
        onStartOAuth: (provider: ModelInventoryProvider, close: () => void) => void;
    }
) {
    if (item.provider?.isConnected) {
        handlers.close();
        handlers.onShowInstructions(item.provider);
        return;
    }

    switch (item.kind) {
        case 'api-key':
            handlers.close();
            handlers.onAddKey(item.apiKeyOption);
            return;
        case 'oauth':
            if (item.provider) {
                handlers.onStartOAuth(item.provider, handlers.close);
            }
            return;
        default:
            handlers.close();
            if (item.provider) {
                handlers.onShowInstructions(item.provider);
            }
    }
}

type ProviderSetupAction = 'api-key' | 'oauth' | 'external' | 'system' | 'manual';

type ProviderSetupItem =
    | {
          apiKeyOption: ModelProviderApiKeyOption;
          displayName: string;
          id: string;
          kind: 'api-key';
          provider: ModelInventoryProvider | null;
          providerId: string;
      }
    | {
          displayName: string;
          id: string;
          kind: Exclude<ProviderSetupAction, 'api-key'>;
          provider: ModelInventoryProvider;
          providerId: string;
      };

function filterProviderItems(items: ProviderSetupItem[], query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return items;
    }

    return items.filter((item) => {
        const haystack = [
            item.displayName,
            item.providerId,
            item.kind,
            item.provider?.keyEnv,
            item.provider?.authType,
            item.provider?.stateMessage,
            item.kind === 'api-key' ? item.apiKeyOption.envKey : null,
            item.kind === 'api-key' ? item.apiKeyOption.description : null,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return haystack.includes(normalizedQuery);
    });
}

function createProviderSetupItems(
    providers: ModelInventoryProvider[],
    apiKeyOptions: ModelProviderApiKeyOption[]
): ProviderSetupItem[] {
    const usedEnvKeys = new Set<string>();
    const optionsByHint = new Map<string, ModelProviderApiKeyOption>();
    for (const option of apiKeyOptions) {
        for (const hint of optionHints(option)) {
            if (hint && !optionsByHint.has(hint)) {
                optionsByHint.set(hint, option);
            }
        }
    }

    const items: ProviderSetupItem[] = providers.map((provider) => {
        const option = provider.keyEnv
            ? (apiKeyOptions.find((candidate) => candidate.envKey === provider.keyEnv) ??
              toApiKeyOption(provider))
            : findProviderApiKeyOption(provider, optionsByHint);
        const kind = getProviderSetupAction(provider, option);
        if (kind === 'api-key' && option) {
            usedEnvKeys.add(option.envKey);
            return {
                apiKeyOption: option,
                displayName: provider.displayName,
                id: `provider:${provider.provider}`,
                kind,
                provider,
                providerId: provider.provider,
            };
        }
        const fallbackKind = kind === 'api-key' ? 'manual' : kind;

        return {
            displayName: provider.displayName,
            id: `provider:${provider.provider}`,
            kind: fallbackKind,
            provider,
            providerId: provider.provider,
        };
    });

    for (const option of apiKeyOptions) {
        if (usedEnvKeys.has(option.envKey)) {
            continue;
        }
        if (option.isSet) {
            continue;
        }
        items.push({
            apiKeyOption: option,
            displayName: option.label,
            id: `env:${option.envKey}`,
            kind: 'api-key',
            provider: null,
            providerId: option.providerHint ?? option.envKey,
        });
    }

    return items.sort(
        (left, right) =>
            left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id)
    );
}

function getProviderSetupAction(
    provider: ModelInventoryProvider,
    apiKeyOption: ModelProviderApiKeyOption | null
): ProviderSetupAction {
    if (provider.authType === 'api_key' && apiKeyOption) {
        return 'api-key';
    }

    switch (provider.authAction) {
        case 'api-key':
            return apiKeyOption ? 'api-key' : 'manual';
        case 'oauth':
            return 'oauth';
        case 'external':
            return 'external';
        case 'system':
            return 'system';
        default:
            return 'manual';
    }
}

function findProviderApiKeyOption(
    provider: ModelInventoryProvider,
    optionsByHint: Map<string, ModelProviderApiKeyOption>
) {
    for (const hint of providerHints(provider)) {
        const option = hint ? optionsByHint.get(hint) : null;
        if (option) {
            return option;
        }
    }
    return null;
}

function toApiKeyOption(provider: ModelInventoryProvider): ModelProviderApiKeyOption {
    return {
        description: provider.connectionDetail,
        docsUrl: null,
        envKey: provider.keyEnv ?? '',
        isSet: false,
        label: provider.displayName,
        providerHint: normalizeHint(provider.provider),
    };
}

function optionHints(option: ModelProviderApiKeyOption) {
    return [option.providerHint, option.envKey, option.label].map(normalizeHint).filter(Boolean);
}

function providerHints(provider: ModelInventoryProvider) {
    return [provider.provider, provider.displayName, provider.keyEnv]
        .map(normalizeHint)
        .filter(Boolean);
}

function normalizeHint(value: string | null | undefined) {
    const normalized = (value ?? '')
        .replace(/_(?:GITHUB_TOKEN|API_KEY|TOKEN)$/u, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-|-$/gu, '');
    return normalized || null;
}
