import { createRouter } from '../trpc.ts';
import { simulateTurnRoute } from './simulate-turn.ts';

export const devRouter = createRouter({
    simulateTurn: simulateTurnRoute,
});
