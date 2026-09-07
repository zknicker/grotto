import { expect, test } from 'bun:test';
import { cloudAgentWorkSchema } from '@grotto/api';
import { work } from '../../../../../packages/grotto-api/src/cloud-agent-fixture.ts';
import { indexCloudAgentWorkByThreadAnchor } from './hoisted-cloud-agent-work.ts';

test('every delegation stays under its anchor, in creation order, including completed work', () => {
    const running = cloudAgentWorkSchema.parse(work);
    const completed = cloudAgentWorkSchema.parse({
        ...work,
        id: 'caw_completed',
        status: 'completed',
    });
    const index = indexCloudAgentWorkByThreadAnchor([
        { anchorMessageId: 'msg_task', work: running },
        { anchorMessageId: 'msg_task', work: completed },
        { anchorMessageId: 'msg_other', work: running },
    ]);
    expect(index.get('msg_task')).toEqual([running, completed]);
    expect(index.get('msg_other')).toEqual([running]);
});

test('standalone delegation appears in its own Thread carousel', () => {
    const standalone = cloudAgentWorkSchema.parse(work);
    expect(
        indexCloudAgentWorkByThreadAnchor([
            { anchorMessageId: standalone.messageId, work: standalone },
        ]).get(standalone.messageId)
    ).toEqual([standalone]);
});

test('unloaded query supplies no rows', () => {
    expect(indexCloudAgentWorkByThreadAnchor(undefined).size).toBe(0);
});
