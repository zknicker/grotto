import { Breadcrumbs } from '@heroui/react';
import { ComputerIcon } from '@hugeicons-pro/core-stroke-rounded';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { useMember } from '../../../hooks/members/use-member.ts';
import { humanDisplayName } from '../../servers/human-identity.ts';
import { serverSettingsSectionRoute } from '../../servers/server-routes.ts';
import { type SettingsRouteTab, settingsNavItems, settingsNavSections } from './navigation.ts';

/**
 * Where you are, in the band the rest of the app uses for content identity.
 *
 * Settings registered nothing there, so every settings route drew an empty
 * band with a hairline under it — chrome that looks unfinished rather than
 * deliberately blank. The group is the part worth showing: the page already
 * names itself in `SettingsPageHeader`, but nothing else says which of the
 * three subjects it belongs to, and the rail's answer scrolls away.
 *
 * The group is a label, not a destination — a section is a heading in the
 * rail, not a page — so only the section crumb carries an href.
 */
export function SettingsBreadcrumb({
    pathname,
    section,
    serverId,
    slug,
}: {
    pathname: string;
    section: SettingsRouteTab | undefined;
    serverId: string;
    slug: string;
}) {
    const leaf = useLeafCrumb(pathname, serverId);
    const crumb = section ? resolveCrumb(section) : undefined;

    if (!crumb) {
        return null;
    }

    const sectionHref = serverSettingsSectionRoute(slug, crumb.id);

    return (
        <div className="flex min-w-0 shrink items-center gap-2">
            {crumb.icon ? (
                <Icon
                    aria-hidden="true"
                    className="shrink-0 text-muted"
                    icon={crumb.icon}
                    size={16}
                />
            ) : null}
            <Breadcrumbs className="min-w-0">
                <Breadcrumbs.Item>{crumb.group}</Breadcrumbs.Item>
                {/* A section stops being the destination once you are inside
                    one of its records, so it takes the href and the record
                    becomes the current crumb. */}
                <Breadcrumbs.Item href={leaf ? sectionHref : undefined}>
                    {crumb.label}
                </Breadcrumbs.Item>
                {leaf ? (
                    <Breadcrumbs.Item>
                        {/* The record's own mark beside its name — the crumb
                            names a member, and members lead with their face
                            everywhere else in the app. */}
                        <span className="flex min-w-0 items-center gap-1.5">
                            <EntityAvatar name={leaf.name} size={18} src={leaf.avatarUrl} />
                            <span className="min-w-0 truncate">{leaf.name}</span>
                        </span>
                    </Breadcrumbs.Item>
                ) : null}
            </Breadcrumbs>
        </div>
    );
}

/**
 * The human a Members sub-route is showing: their name and identity mark.
 * Agents have their own page outside Settings, so only humans reach here.
 *
 * Read here rather than pushed up from the detail page: this is the query that
 * page already runs, so React Query serves it from the same cache entry and
 * nothing has to plumb a name back through context.
 */
function useLeafCrumb(
    pathname: string,
    serverId: string
): { avatarUrl: string | null; name: string } | undefined {
    const userId = matchHumanId(pathname);
    const member = useMember(serverId, userId);

    if (!(userId && member.data)) {
        return undefined;
    }
    return { avatarUrl: member.data.avatarUrl, name: humanDisplayName(member.data) };
}

function matchHumanId(pathname: string): string | undefined {
    const marker = '/settings/members/humans/';
    const start = pathname.indexOf(marker);
    if (start === -1) {
        return undefined;
    }
    const id = pathname.slice(start + marker.length).split('/')[0];
    return id ? decodeURIComponent(id) : undefined;
}

/**
 * Computers is not in the nav item list — its rows come from the roster — so
 * it names its own place in Settings.
 */
const computersCrumb = {
    group: 'Settings',
    icon: ComputerIcon,
    id: 'computers',
    label: 'Computers',
} as const;

function resolveCrumb(section: SettingsRouteTab) {
    if (section === computersCrumb.id) {
        return computersCrumb;
    }

    const item = settingsNavItems.find((candidate) => candidate.id === section);
    if (!item) {
        return undefined;
    }
    const group = settingsNavSections.find((candidate) =>
        (candidate.itemIds as readonly string[]).includes(item.id)
    );

    return { group: group?.label ?? 'Settings', icon: item.icon, id: item.id, label: item.label };
}
