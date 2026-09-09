import { expect, test } from 'bun:test';
import { buildTaskCommandGroup } from './task-commands.ts';
import type { AppCommand } from './types.ts';
import { getCommandSearchText } from './types.ts';

test('the palette entry reads as what pressing it does and flips the preference', async () => {
    const applied: boolean[] = [];
    const setShowTasksInChat = (enabled: boolean) => applied.push(enabled);
    const hidden = toggleCommand(
        buildTaskCommandGroup({ setShowTasksInChat, showTasksInChat: false })
    );
    const showing = toggleCommand(
        buildTaskCommandGroup({ setShowTasksInChat, showTasksInChat: true })
    );

    expect(hidden.id).toBe('tasks.show-in-chat');
    expect(hidden.title).toBe('Show tasks in chat');
    expect(showing.title).toBe('Hide tasks in chat');
    expect(getCommandSearchText(hidden).toLowerCase()).toContain('task');

    await hidden.run();
    await showing.run();

    expect(applied).toEqual([true, false]);
});

function toggleCommand(group: { commands: readonly AppCommand[] }): AppCommand {
    const [command, ...rest] = group.commands;

    if (!command || rest.length > 0) {
        throw new Error('the Tasks group should carry exactly one command');
    }

    return command;
}
