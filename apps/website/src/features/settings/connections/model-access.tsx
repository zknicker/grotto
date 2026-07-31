import { Button, Separator, Skeleton } from '@heroui/react';
import * as React from 'react';
import { useCancelModelProviderOAuth } from '../../../hooks/connections/use-cancel-model-provider-oauth.ts';
import { usePollModelProviderOAuth } from '../../../hooks/connections/use-poll-model-provider-oauth.ts';
import { useSaveModelProviderApiKey } from '../../../hooks/connections/use-save-model-provider-api-key.ts';
import { useStartModelProviderOAuth } from '../../../hooks/connections/use-start-model-provider-oauth.ts';
import { useSubmitModelProviderOAuth } from '../../../hooks/connections/use-submit-model-provider-oauth.ts';
import { invalidateModelList } from '../../../hooks/models/invalidate-model-list.ts';
import { useModelInventory } from '../../../hooks/models/use-model-inventory.ts';
import { useSetModelProviderEnabled } from '../../../hooks/models/use-set-model-provider-enabled.ts';
import { getModelProviderConfig } from '../../../lib/model-provider-config.ts';
import { type ModelInventoryOutput, trpc } from '../../../lib/trpc.tsx';
import { SettingsGroup, SettingsItem, SettingsSection } from '../layout/settings-page.tsx';
import { ModelAccessProviderRow } from './model-access-provider-row.tsx';
import { ProviderCatalogPopover } from './provider-catalog-popover.tsx';
import {
    ProviderApiKeyDialog,
    ProviderInstructionsDialog,
    ProviderOAuthDialog,
} from './provider-setup-dialogs.tsx';

type ModelInventoryProvider = ModelInventoryOutput['providers'][number];
type ModelProviderApiKeyOption = ModelInventoryOutput['apiKeyOptions'][number];
export function ModelAccessSettings() {
    const utils = trpc.useUtils();
    const inventoryQuery = useModelInventory();
    const saveApiKeyMutation = useSaveModelProviderApiKey();
    const cancelOAuthMutation = useCancelModelProviderOAuth();
    const startOAuthMutation = useStartModelProviderOAuth();
    const submitOAuthMutation = useSubmitModelProviderOAuth();
    const setProviderEnabledMutation = useSetModelProviderEnabled();
    const approvedOAuthSessionIdsRef = React.useRef(new Set<string>());
    const [apiKeyOption, setApiKeyOption] = React.useState<ModelProviderApiKeyOption | null>(null);
    const [instructionsProvider, setInstructionsProvider] =
        React.useState<ModelInventoryProvider | null>(null);
    const [removeErrorProviderId, setRemoveErrorProviderId] = React.useState<string | null>(null);
    const [removingProviderId, setRemovingProviderId] = React.useState<string | null>(null);
    const [oauthStart, setOAuthStart] = React.useState<NonNullable<
        typeof startOAuthMutation.data
    > | null>(null);
    const [oauthProviderLabel, setOAuthProviderLabel] = React.useState('Provider');
    const [oauthProviderId, setOAuthProviderId] = React.useState<string | null>(null);
    const [pendingOAuthProviderId, setPendingOAuthProviderId] = React.useState<string | null>(null);
    const [oauthPollStatus, setOAuthPollStatus] = React.useState<string | null>(null);
    const [oauthSubmitMessage, setOAuthSubmitMessage] = React.useState<string | null>(null);
    const oauthPollInput =
        oauthStart && oauthProviderId && oauthStart.flow !== 'pkce'
            ? { providerId: oauthProviderId, sessionId: oauthStart.sessionId }
            : null;
    const oauthPollQuery = usePollModelProviderOAuth(oauthPollInput, {
        enabled:
            Boolean(oauthPollInput) && (oauthPollStatus === null || oauthPollStatus === 'pending'),
        refetchInterval:
            oauthStart?.flow === 'device_code' ? Math.max(oauthStart.pollInterval, 2) * 1000 : 2000,
    });

    React.useEffect(() => {
        const pollResult = oauthPollQuery.data;
        if (!pollResult) {
            return;
        }
        const status = pollResult.status;
        setOAuthPollStatus(status);
        if (status === 'approved') {
            approvedOAuthSessionIdsRef.current.add(pollResult.sessionId);
            setOAuthStart(null);
            setOAuthProviderId(null);
            void Promise.all([inventoryQuery.refetch(), invalidateModelList(utils)]);
        }
    }, [inventoryQuery.refetch, oauthPollQuery.data, utils]);

    if (inventoryQuery.isLoading) {
        return (
            <SettingsSection title="Model Providers">
                <SettingsGroup>
                    <Skeleton className="h-[4.25rem] rounded-none" />
                    <Separator />
                    <Skeleton className="h-[4.25rem] rounded-none" />
                    <Separator />
                    <Skeleton className="h-[4.25rem] rounded-none" />
                </SettingsGroup>
            </SettingsSection>
        );
    }

    const providerRows = inventoryQuery.data?.providers ?? [];
    const catalogProviders = inventoryQuery.data?.catalogProviders ?? [];
    const apiKeyOptions = inventoryQuery.data?.apiKeyOptions ?? [];
    const enabledProviders = providerRows;
    const setupApiKeyOptions = apiKeyOptions.filter(
        (option) =>
            !enabledProviders.some((provider) => isApiKeyOptionForProvider(option, provider))
    );
    const hasUnsetApiKeyOption = setupApiKeyOptions.some((option) => !option.isSet);
    const providerCatalog = (
        <ProviderCatalogPopover
            apiKeyOptions={setupApiKeyOptions}
            disabled={catalogProviders.length === 0 && !hasUnsetApiKeyOption}
            error={
                startOAuthMutation.error?.message ??
                setProviderEnabledMutation.error?.message ??
                null
            }
            onAddKey={setApiKeyOption}
            onShowInstructions={(provider) => {
                setProviderEnabledMutation.reset();
                setProviderEnabledMutation.mutate(
                    { enabled: true, providerId: provider.provider },
                    {
                        onSuccess: () => {
                            if (!provider.isConnected) {
                                setInstructionsProvider(provider);
                            }
                        },
                    }
                );
            }}
            onStartOAuth={(provider, closeCatalog) =>
                handleStartProviderOAuth({
                    mutate: startOAuthMutation.mutate,
                    onSettled: () => setPendingOAuthProviderId(null),
                    onSuccess: (result) => {
                        closeCatalog();
                        setOAuthProviderId(provider.provider);
                        setOAuthProviderLabel(provider.displayName);
                        setOAuthPollStatus(null);
                        setOAuthSubmitMessage(null);
                        setOAuthStart(result);
                        if ('authUrl' in result) {
                            globalThis.open(result.authUrl, '_blank', 'noopener');
                        } else {
                            globalThis.open(result.verificationUrl, '_blank', 'noopener');
                        }
                    },
                    provider,
                    setPendingProviderId: setPendingOAuthProviderId,
                })
            }
            pendingProviderId={pendingOAuthProviderId}
            providers={catalogProviders}
            showIcon={enabledProviders.length > 0}
        />
    );

    return (
        <SettingsSection action={providerCatalog} title="Model Providers">
            <SettingsGroup>
                {enabledProviders.length > 0 ? (
                    enabledProviders.map((provider, index) => (
                        <div key={provider.provider}>
                            {index > 0 ? <Separator /> : null}
                            <EnabledAgentProviderRow
                                connectPending={pendingOAuthProviderId === provider.provider}
                                error={
                                    removeErrorProviderId === provider.provider
                                        ? setProviderEnabledMutation.error?.message
                                        : null
                                }
                                onConfigure={
                                    isApiKeyProvider(provider) ||
                                    (provider.authAction === 'oauth' && provider.keyEnv)
                                        ? () => setApiKeyOption(toProviderApiKeyOption(provider))
                                        : null
                                }
                                onConnect={
                                    provider.authAction === 'oauth'
                                        ? () =>
                                              handleStartProviderOAuth({
                                                  mutate: startOAuthMutation.mutate,
                                                  onSettled: () => setPendingOAuthProviderId(null),
                                                  onSuccess: (result) => {
                                                      setOAuthProviderId(provider.provider);
                                                      setOAuthProviderLabel(provider.displayName);
                                                      setOAuthPollStatus(null);
                                                      setOAuthSubmitMessage(null);
                                                      setOAuthStart(result);
                                                      if ('authUrl' in result) {
                                                          globalThis.open(
                                                              result.authUrl,
                                                              '_blank',
                                                              'noopener'
                                                          );
                                                      } else {
                                                          globalThis.open(
                                                              result.verificationUrl,
                                                              '_blank',
                                                              'noopener'
                                                          );
                                                      }
                                                  },
                                                  provider,
                                                  setPendingProviderId: setPendingOAuthProviderId,
                                              })
                                        : null
                                }
                                onRemove={() => {
                                    setProviderEnabledMutation.reset();
                                    setRemoveErrorProviderId(null);
                                    setRemovingProviderId(provider.provider);
                                    setProviderEnabledMutation.mutate(
                                        { enabled: false, providerId: provider.provider },
                                        {
                                            onError: () =>
                                                setRemoveErrorProviderId(provider.provider),
                                            onSettled: () => setRemovingProviderId(null),
                                            onSuccess: () => setRemoveErrorProviderId(null),
                                        }
                                    );
                                }}
                                pending={removingProviderId === provider.provider}
                                provider={provider}
                            />
                        </div>
                    ))
                ) : (
                    <NoConnectedProviders />
                )}
            </SettingsGroup>

            {apiKeyOption ? (
                <ProviderApiKeyDialog
                    keyEnv={apiKeyOption.envKey}
                    label={apiKeyOption.label}
                    onOpenChange={(open) => {
                        if (!open) {
                            setApiKeyOption(null);
                        }
                    }}
                    onSave={(apiKey) =>
                        saveApiKeyMutation.mutate(
                            {
                                apiKey,
                                keyEnv: apiKeyOption.envKey,
                            },
                            {
                                onSuccess: () => setApiKeyOption(null),
                            }
                        )
                    }
                    open={Boolean(apiKeyOption)}
                    saveError={saveApiKeyMutation.error?.message ?? null}
                    savePending={saveApiKeyMutation.isPending}
                />
            ) : null}

            <ProviderInstructionsDialog
                onOpenChange={(open) => {
                    if (!open) {
                        setInstructionsProvider(null);
                    }
                }}
                open={Boolean(instructionsProvider)}
                provider={instructionsProvider}
            />

            <ProviderOAuthDialog
                label={oauthProviderLabel}
                onOpenChange={(open) => {
                    if (!open) {
                        if (
                            oauthStart &&
                            !approvedOAuthSessionIdsRef.current.has(oauthStart.sessionId)
                        ) {
                            cancelOAuthMutation.mutate({ sessionId: oauthStart.sessionId });
                        }
                        setOAuthStart(null);
                        setOAuthProviderId(null);
                        setOAuthPollStatus(null);
                        setOAuthSubmitMessage(null);
                    }
                }}
                onSubmitCode={(code) => {
                    if (!(oauthProviderId && oauthStart)) {
                        return;
                    }
                    setOAuthSubmitMessage(null);
                    submitOAuthMutation.mutate(
                        {
                            code,
                            providerId: oauthProviderId,
                            sessionId: oauthStart.sessionId,
                        },
                        {
                            onSuccess: (result) => {
                                if (result.status === 'approved') {
                                    approvedOAuthSessionIdsRef.current.add(oauthStart.sessionId);
                                    setOAuthStart(null);
                                    setOAuthProviderId(null);
                                    setOAuthPollStatus(null);
                                    setOAuthSubmitMessage(null);
                                    void Promise.all([
                                        inventoryQuery.refetch(),
                                        invalidateModelList(utils),
                                    ]);
                                    return;
                                }
                                setOAuthSubmitMessage(
                                    result.message ?? `Sign-in status: ${result.status}.`
                                );
                            },
                        }
                    );
                }}
                open={Boolean(oauthStart)}
                pollError={oauthPollQuery.error?.message ?? null}
                pollStatus={oauthPollQuery.data?.status ?? null}
                result={oauthStart}
                submitError={submitOAuthMutation.error?.message ?? oauthSubmitMessage}
                submitPending={submitOAuthMutation.isPending}
            />
        </SettingsSection>
    );
}

function handleStartProviderOAuth({
    mutate,
    onSettled,
    onSuccess,
    provider,
    setPendingProviderId,
}: {
    mutate: ReturnType<typeof useStartModelProviderOAuth>['mutate'];
    onSettled: () => void;
    onSuccess: (result: NonNullable<ReturnType<typeof useStartModelProviderOAuth>['data']>) => void;
    provider: ModelInventoryProvider;
    setPendingProviderId: (providerId: string | null) => void;
}) {
    setPendingProviderId(provider.provider);
    mutate(
        { providerId: provider.provider },
        {
            onSettled,
            onSuccess,
        }
    );
}

function EnabledAgentProviderRow({
    connectPending = false,
    error,
    onConfigure,
    onConnect,
    onRemove,
    pending,
    provider,
}: {
    connectPending?: boolean;
    error?: string | null;
    onConfigure: (() => void) | null;
    onConnect?: (() => void) | null;
    onRemove: () => void;
    pending: boolean;
    provider: ModelInventoryProvider;
}) {
    const providerConfig = getModelProviderConfig(provider.provider);
    // The action buttons already say what to do; only keep the setup hint
    // when the row has no button to offer.
    const description = onConnect || onConfigure ? '' : (provider.connectionDetail ?? '');

    return (
        <ModelAccessProviderRow
            color={providerConfig.color}
            description={description}
            error={error}
            icon={providerConfig.icon}
            label={provider.displayName}
            logo={providerConfig.logo}
            state={provider.isConnected ? 'live' : 'needs-auth'}
        >
            {onConnect ? (
                <Button
                    isPending={connectPending}
                    onPress={onConnect}
                    size="sm"
                    type="button"
                    variant="secondary"
                >
                    Connect
                </Button>
            ) : null}
            {onConfigure ? (
                <Button onPress={onConfigure} size="sm" type="button" variant="ghost">
                    {provider.isConnected ? 'Edit Key' : 'Add Key'}
                </Button>
            ) : null}
            <Button isPending={pending} onPress={onRemove} size="sm" type="button" variant="ghost">
                Remove
            </Button>
        </ModelAccessProviderRow>
    );
}

function NoConnectedProviders() {
    return (
        <SettingsItem>
            <div className="min-w-0">
                <h3 className="font-medium text-foreground text-sm">No Connected Providers</h3>
                <div className="text-muted text-sm">Add a provider to surface models.</div>
            </div>
        </SettingsItem>
    );
}

function isApiKeyOptionForProvider(
    option: ModelProviderApiKeyOption,
    provider: ModelInventoryProvider
) {
    const optionHint = normalizeProviderHint(option.providerHint ?? option.label);
    if (!optionHint) {
        return false;
    }

    return [provider.provider, provider.displayName].some((value) => {
        const providerHint = normalizeProviderHint(value);
        return providerHint === optionHint || providerHint === `${optionHint}-api`;
    });
}

function isApiKeyProvider(provider: ModelInventoryProvider) {
    return provider.authAction === 'api-key' && Boolean(provider.keyEnv);
}

function toProviderApiKeyOption(provider: ModelInventoryProvider): ModelProviderApiKeyOption {
    return {
        description: provider.connectionDetail,
        docsUrl: null,
        envKey: provider.keyEnv ?? '',
        isSet: provider.isConnected,
        label: provider.displayName,
        providerHint: provider.provider,
    };
}

function normalizeProviderHint(value: string | null | undefined) {
    const normalized = (value ?? '')
        .replace(/_(?:GITHUB_TOKEN|API_KEY|TOKEN)$/u, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-|-$/gu, '');
    return normalized || null;
}
