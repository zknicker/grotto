import Foundation
import GrottoModels

enum TaskPreviewFixtures {
    static let items: [TaskListItem] = decode(
        """
        [
          {"chatKind":"channel","chatName":"product","chatPeerUserId":null,
           "message":{"attachments":[],"author":{"kind":"human","userId":"user_preview","profile":null},"chatId":"chat_product","content":"Review the native message timeline","createdAt":"2026-01-01T00:00:00Z","id":"message_task_1","nonce":"nonce_1","runId":null,"sequence":1,"serverId":"server_preview","task":null},
           "task":{"assigneeAgentId":null,"assigneeUserId":null,"chatId":"chat_product","claimedAt":null,"createdAt":"2026-01-01T00:00:00Z","createdByAgentId":null,"createdByUserId":"user_preview","labels":[],"messageId":"message_task_1","number":12,"origin":"converted","priority":"high","status":"in_progress","threadChatId":"thread_1","updatedAt":"2026-01-01T00:00:00Z","version":1},
           "threadSummary":{"anchorMessageId":"message_task_1","followed":false,"latestReplyAt":"2026-01-01T00:00:00Z","recentReplies":[],"replyCount":2,"threadChatId":"thread_1","unreadCount":0}},
          {"chatKind":"channel","chatName":"product","chatPeerUserId":null,
           "message":{"attachments":[],"author":{"kind":"human","userId":"user_preview","profile":null},"chatId":"chat_product","content":"Wire the iPhone task lens to Server state","createdAt":"2026-01-01T00:00:00Z","id":"message_task_2","nonce":"nonce_2","runId":null,"sequence":2,"serverId":"server_preview","task":null},
           "task":{"assigneeAgentId":null,"assigneeUserId":null,"chatId":"chat_product","claimedAt":null,"createdAt":"2026-01-01T00:00:00Z","createdByAgentId":null,"createdByUserId":"user_preview","labels":[],"messageId":"message_task_2","number":13,"origin":"converted","priority":"medium","status":"todo","threadChatId":"thread_2","updatedAt":"2026-01-01T00:00:00Z","version":1},
           "threadSummary":{"anchorMessageId":"message_task_2","followed":false,"latestReplyAt":null,"recentReplies":[],"replyCount":0,"threadChatId":"thread_2","unreadCount":0}},
          {"chatKind":"channel","chatName":"product","chatPeerUserId":null,
           "message":{"attachments":[],"author":{"kind":"human","userId":"user_preview","profile":null},"chatId":"chat_product","content":"Ship the first mobile release","createdAt":"2026-01-01T00:00:00Z","id":"message_task_3","nonce":"nonce_3","runId":null,"sequence":3,"serverId":"server_preview","task":null},
           "task":{"assigneeAgentId":null,"assigneeUserId":null,"chatId":"chat_product","claimedAt":null,"createdAt":"2026-01-01T00:00:00Z","createdByAgentId":null,"createdByUserId":"user_preview","labels":[],"messageId":"message_task_3","number":14,"origin":"converted","priority":"none","status":"done","threadChatId":"thread_3","updatedAt":"2026-01-01T00:00:00Z","version":1},
           "threadSummary":{"anchorMessageId":"message_task_3","followed":false,"latestReplyAt":"2026-01-01T00:00:00Z","recentReplies":[],"replyCount":4,"threadChatId":"thread_3","unreadCount":0}}
        ]
        """
    )

    private static func decode<Value: Decodable>(_ json: String) -> Value {
        do {
            return try GrottoJSON.decoder().decode(Value.self, from: Data(json.utf8))
        } catch {
            preconditionFailure("Invalid task preview fixture: \(error)")
        }
    }
}
