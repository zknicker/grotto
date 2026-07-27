import { expect, test } from 'bun:test';
import { isDeleteServerConfirmation } from './delete-server-dialog.tsx';

test('Server deletion requires the exact slug without the fixed slash prefix', () => {
    expect(isDeleteServerConfirmation('vanishing-hq', 'vanishing-hq')).toBe(true);
    expect(isDeleteServerConfirmation('/vanishing-hq', 'vanishing-hq')).toBe(false);
    expect(isDeleteServerConfirmation('Vanishing-hq', 'vanishing-hq')).toBe(false);
    expect(isDeleteServerConfirmation('vanishing-hq ', 'vanishing-hq')).toBe(false);
});
