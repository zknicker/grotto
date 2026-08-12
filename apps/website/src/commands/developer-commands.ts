import { CommandIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { AppCommandBuildContext, AppCommandGroup } from './types.ts';

export function buildDeveloperCommandGroup(context: AppCommandBuildContext): AppCommandGroup {
    return {
        commands: [
            {
                icon: CommandIcon,
                id: 'developer.toggle-dev-mode',
                keywords: ['developer', 'debug', 'dev'],
                run: () => context.setDevMode(!context.devMode),
                title: context.devMode ? 'Turn Dev Mode Off' : 'Turn Dev Mode On',
            },
        ],
        id: 'developer',
        title: 'Developer',
    };
}
