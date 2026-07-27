import type { HostedTaskAssignee } from '@tavern/api';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { requireChatAccess } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { channelParticipantsTable, serverMembershipsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { TaskAdminRequiredError } from './assign-task.ts';
import { HostedTaskNotFoundError } from './claim-task.ts';
import { findHostedMessageTask } from './task-shape.ts';

export async function listHostedTaskAssignees(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { messageId: string; serverId: string }
): Promise<HostedTaskAssignee[]> {
    const server = await requireServerMembership(db, member, input.serverId);
    if (server.role !== 'owner' && server.role !== 'admin') {
        throw new TaskAdminRequiredError();
    }
    const task = await findHostedMessageTask(db, input.serverId, input.messageId);
    if (!task) {
        throw new HostedTaskNotFoundError();
    }
    const chat = await requireChatAccess(db, member, {
        chatId: task.chatId,
        serverId: input.serverId,
    });
    const selection = {
        role: serverMembershipsTable.role,
        userId: serverMembershipsTable.userId,
    };
    const memberships =
        chat.kind === 'channel'
            ? await db
                  .select(selection)
                  .from(serverMembershipsTable)
                  .innerJoin(
                      channelParticipantsTable,
                      and(
                          eq(channelParticipantsTable.serverId, serverMembershipsTable.serverId),
                          eq(channelParticipantsTable.userId, serverMembershipsTable.userId),
                          eq(channelParticipantsTable.chatId, chat.id)
                      )
                  )
                  .where(
                      and(
                          eq(serverMembershipsTable.serverId, input.serverId),
                          isNull(serverMembershipsTable.revokedAt)
                      )
                  )
                  .orderBy(asc(serverMembershipsTable.userId))
            : await db
                  .select(selection)
                  .from(serverMembershipsTable)
                  .where(
                      and(
                          eq(serverMembershipsTable.serverId, input.serverId),
                          isNull(serverMembershipsTable.revokedAt),
                          inArray(serverMembershipsTable.userId, [
                              chat.dmMemberOneUserId as string,
                              chat.dmMemberTwoUserId as string,
                          ])
                      )
                  )
                  .orderBy(asc(serverMembershipsTable.userId));

    return memberships.map((candidate) => ({
        role: candidate.role as HostedTaskAssignee['role'],
        userId: candidate.userId,
    }));
}
