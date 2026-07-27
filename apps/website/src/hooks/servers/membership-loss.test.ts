import assert from 'node:assert/strict';
import test from 'node:test';
import { isMembershipLoss } from './membership-loss.ts';

function subscriptionError(code: string) {
    return { data: { code }, message: 'You are not a member of this Grotto server.' };
}

test('a refused Server feed is treated as losing access', () => {
    assert.equal(isMembershipLoss(subscriptionError('FORBIDDEN')), true);
    assert.equal(isMembershipLoss(subscriptionError('NOT_FOUND')), true);
});

test('an expired session is not a membership change', () => {
    assert.equal(isMembershipLoss(subscriptionError('UNAUTHORIZED')), false);
});

test('a dropped socket leaves cached Server state alone', () => {
    assert.equal(isMembershipLoss(new Error('WebSocket closed')), false);
    assert.equal(isMembershipLoss(subscriptionError('INTERNAL_SERVER_ERROR')), false);
    assert.equal(isMembershipLoss(undefined), false);
    assert.equal(isMembershipLoss({ data: null }), false);
});
