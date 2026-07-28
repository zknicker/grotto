import type { RuntimeUser } from '@tavern/api';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar.tsx';
import { appRoutes } from '../../lib/app-routes.ts';
import { isClerkEnabled } from '../../lib/clerk.tsx';
import { trpc } from '../../lib/trpc.tsx';

export function HumanMemberList() {
    if (!isClerkEnabled) {
        return <MemberSection count={0} users={[]} />;
    }

    return <SignedInHumanMemberList />;
}

function SignedInHumanMemberList() {
    const members = trpc.identity.members.useQuery();
    const users = members.data?.members.map((member) => member.user) ?? [];

    return <MemberSection count={users.length} users={users} />;
}

function MemberSection({ count, users }: { count: number; users: RuntimeUser[] }) {
    return (
        <HumanMemberSection count={count} manageTo={appRoutes.membersHumans}>
            {users.map((user) => {
                const name = getUserDisplayName(user);
                return (
                    <div
                        className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2"
                        key={user.id}
                    >
                        <Avatar className="size-8">
                            {user.avatarUrl ? (
                                <AvatarImage alt={`${name} avatar`} src={user.avatarUrl} />
                            ) : null}
                            <AvatarFallback>{getInitials(name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="truncate font-medium text-sm">{name}</p>
                            {user.email ? (
                                <p className="truncate text-muted-foreground text-sm">
                                    {user.email}
                                </p>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </HumanMemberSection>
    );
}

export function HumanMemberSection({
    children,
    count,
    manageTo,
}: {
    children: ReactNode;
    count: number;
    manageTo: string;
}) {
    return (
        <section className="mt-6">
            <div className="mb-2 flex items-center justify-between px-3">
                <h2 className="flex items-center gap-2 font-mono text-sidebar-muted text-xs uppercase tracking-wider">
                    <span>Humans</span>
                    <span className="tabular-nums">{count}</span>
                </h2>
                <NavLink
                    className={({ isActive }) =>
                        isActive
                            ? 'font-medium text-foreground text-xs'
                            : 'text-sidebar-muted text-xs hover:text-foreground'
                    }
                    to={manageTo}
                >
                    Manage
                </NavLink>
            </div>
            <div className="space-y-1">{children}</div>
        </section>
    );
}

export function getUserDisplayName(user: RuntimeUser) {
    return user.name ?? user.email ?? user.id;
}

export function getInitials(value: string) {
    const parts = value.trim().split(/\s+/u);
    return parts.length > 1
        ? `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase()
        : value.slice(0, 2).toUpperCase();
}
