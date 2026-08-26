import { expect, mock, test } from 'bun:test';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { ServerMenu } from './server-menu.tsx';

test('server creation actions match the standard menu row geometry', () => {
    const menu = ServerMenu({
        currentServer: { id: 'server-1', displayName: 'Tavern', role: 'owner', slug: 'tavern' },
        onCreateServer: () => undefined,
        onJoinServer: () => undefined,
        onOpenArchived: () => undefined,
        onOpenMembers: () => undefined,
        onOpenUsage: () => undefined,
        onSwitchServer: () => undefined,
        servers: [],
    });
    const members = findElementById(menu, 'members');

    for (const id of ['create-server', 'join-server']) {
        const action = findElementById(menu, id);
        const standardIcon = Children.toArray(members.props.children)[0];
        const actionIcon = Children.toArray(action.props.children)[0];

        expect(action.props.className).toBe(members.props.className);
        expect(isValidElement(actionIcon)).toBe(true);
        expect(isValidElement(standardIcon)).toBe(true);
        expect((actionIcon as ReactElement).type).toBe((standardIcon as ReactElement).type);
    }
});

test('selecting the current server does not request navigation', () => {
    const onSwitchServer = mock(() => undefined);
    const menu = ServerMenu({
        currentServer: { id: 'server-1', displayName: 'Tavern', role: 'owner', slug: 'tavern' },
        onCreateServer: () => undefined,
        onJoinServer: () => undefined,
        onOpenArchived: () => undefined,
        onOpenMembers: () => undefined,
        onOpenUsage: () => undefined,
        onSwitchServer,
        servers: [
            { id: 'server-1', displayName: 'Tavern', role: 'owner', slug: 'tavern' },
            { id: 'server-2', displayName: 'Arcade', role: 'member', slug: 'arcade' },
        ],
    });
    const actionMenu = findElementWithAction(menu);

    actionMenu.props.onAction?.('server-1');
    expect(onSwitchServer).not.toHaveBeenCalled();

    actionMenu.props.onAction?.('server-2');
    expect(onSwitchServer).toHaveBeenCalledTimes(1);
    expect(onSwitchServer).toHaveBeenCalledWith('arcade');
});

function findElementById(node: ReactNode, id: string): MenuElement {
    if (isValidElement<MenuElementProps>(node)) {
        if (node.props.id === id) {
            return node;
        }
        for (const child of Children.toArray(node.props.children)) {
            try {
                return findElementById(child, id);
            } catch {
                // Keep walking sibling branches until the requested menu item is found.
            }
        }
    }
    throw new Error(`Unable to find menu item ${id}`);
}

function findElementWithAction(node: ReactNode): MenuElement {
    if (isValidElement<MenuElementProps>(node)) {
        if (node.props.onAction) {
            return node;
        }
        for (const child of Children.toArray(node.props.children)) {
            try {
                return findElementWithAction(child);
            } catch {
                // Keep walking sibling branches until the menu action owner is found.
            }
        }
    }
    throw new Error('Unable to find menu action owner');
}

type MenuElement = ReactElement<MenuElementProps>;

interface MenuElementProps {
    children?: ReactNode;
    className?: string;
    id?: string;
    onAction?: (key: string) => void;
}
