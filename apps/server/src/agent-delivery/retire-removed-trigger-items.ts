import { sql } from 'drizzle-orm';
import type { HausDatabase } from '../postgres/connection.ts';

/** Removes a requeued wake whose Trigger was removed while its run was active. */
export async function retireRemovedTriggerItemsForRun(
    db: HausDatabase,
    agentId: string
): Promise<void> {
    await db.execute(sql`
        delete from agent_inbox as item
        where item.agent_id = ${agentId}
          and item.state = 'queued'
          and item.run_id is null
          and item.source = 'trigger'
          and not exists (
              select 1
              from trigger_fires as fire
              inner join triggers as trigger_row
                  on trigger_row.server_id = fire.server_id
                 and trigger_row.id = fire.trigger_id
              where fire.server_id = item.server_id
                and fire.id = item.dedupe_key
                and trigger_row.deleted_at is null
          )
    `);
}
