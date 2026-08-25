import { Chip, Separator } from '@heroui/react';
import { ItemCard, ItemCardGroup, PressableFeedback } from '@heroui-pro/react';
import { Fragment } from 'react';
import { ConnectionGlyph } from './connection-mark.tsx';
import type { McpConnection } from './mcp-server-shared.ts';

/**
 * The connections this Server has, as the same row the Recommended list uses.
 *
 * This was a DataGrid, which made the two lists on one page read as two kinds
 * of thing: different mark, different box, different left edge, and a Type
 * column whose every cell said "Remote" — connections are Server-owned remote
 * MCP servers, so that column could only ever say one thing. Everything it
 * carried that varies (name, account, status) is an ItemCard slot, and the
 * server's address lives in the detail dialog.
 *
 * Stock ItemCard rendered as a button, per its Pressable pattern.
 */
export function ConnectionList({
    connections,
    onSelect,
}: {
    connections: McpConnection[];
    onSelect: (connectionId: string) => void;
}) {
    return (
        <ItemCardGroup className="overflow-hidden">
            {connections.map((connection, index) => (
                <Fragment key={connection.id}>
                    {index > 0 ? <Separator /> : null}
                    <ItemCard<'button'>
                        className="relative w-full cursor-(--cursor-interactive) overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        // The handler rides on ItemCard, not on the rendered
                        // button: `render` spreads the component's own props
                        // last, so anything set inside it is overwritten.
                        onClick={() => onSelect(connection.id)}
                        render={(props) => <button type="button" {...props} />}
                    >
                        <PressableFeedback.Highlight />
                        <ItemCard.Icon>
                            <ConnectionGlyph connection={connection} />
                        </ItemCard.Icon>
                        <ItemCard.Content>
                            <ItemCard.Title>{connection.name}</ItemCard.Title>
                            <ItemCard.Description>
                                {connectionAccountLabel(connection)}
                            </ItemCard.Description>
                        </ItemCard.Content>
                        <ItemCard.Action>
                            <Chip
                                color={connection.connected ? 'success' : 'default'}
                                size="sm"
                                variant="soft"
                            >
                                {connection.connected ? 'Connected' : 'Not connected'}
                            </Chip>
                        </ItemCard.Action>
                    </ItemCard>
                </Fragment>
            ))}
        </ItemCardGroup>
    );
}

function connectionAccountLabel(connection: McpConnection): string {
    if (connection.accountLabel) {
        return connection.accountLabel;
    }
    return connection.builtIn ? 'Built in' : 'Custom';
}
