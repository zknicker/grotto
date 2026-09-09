import { Button } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import { BrowserIcon } from '@hugeicons-pro/core-stroke-rounded';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import { serverComputersRoute } from '../../servers/server-routes.ts';
import { PageColumn } from '../../shell/page-column.tsx';
import { SettingsPageHeader } from '../layout/settings-page-header.tsx';

/** Browser settings are reached through one explicitly selected Computer. */
export function BrowserSettingsPage({ serverSlug }: { serverSlug: string }) {
    const navigate = useNavigate();

    return (
        <PageColumn>
            <SettingsPageHeader
                description="Browser automation is configured on each Computer, alongside its Cloud Agent connection."
                title="Browser"
            />
            <ItemCardGroup className="overflow-hidden">
                <ItemCard>
                    <ItemCard.Icon>
                        <Icon icon={BrowserIcon} />
                    </ItemCard.Icon>
                    <ItemCard.Content>
                        <ItemCard.Title>Configure Browser per Computer</ItemCard.Title>
                        <ItemCard.Description>
                            Agents assigned to the same Computer share its managed browser profile
                            and signed-in accounts. Choose a Computer to inspect or change its
                            Browser settings.
                        </ItemCard.Description>
                    </ItemCard.Content>
                    <ItemCard.Action>
                        <Button
                            onPress={() => navigate(serverComputersRoute(serverSlug))}
                            size="sm"
                            variant="secondary"
                        >
                            Open Computers
                        </Button>
                    </ItemCard.Action>
                </ItemCard>
            </ItemCardGroup>
        </PageColumn>
    );
}
