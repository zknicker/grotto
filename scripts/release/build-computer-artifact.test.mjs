import { expect, test } from 'bun:test';
import { isAcceptedComputerNotarization } from './build-computer-artifact.mjs';

test('accepts only an explicit successful Computer notarization result', () => {
    expect(
        isAcceptedComputerNotarization({
            id: 'cab4599e-d673-45b9-95f5-5fe5597aa630',
            status: 'Accepted',
        })
    ).toBe(true);
    expect(
        isAcceptedComputerNotarization({
            id: 'cab4599e-d673-45b9-95f5-5fe5597aa630',
            status: 'Invalid',
        })
    ).toBe(false);
    expect(isAcceptedComputerNotarization({ status: 'Accepted' })).toBe(false);
});
