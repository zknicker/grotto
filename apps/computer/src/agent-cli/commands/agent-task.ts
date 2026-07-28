import { defaultTaskDeps } from './agent-task-actions.ts';
import { createTaskSubcommands } from './agent-task-subcommands.ts';

export * from './agent-task-actions.ts';
export { createTaskSubcommands };
export const TASK_SUBCOMMANDS = createTaskSubcommands(defaultTaskDeps);
