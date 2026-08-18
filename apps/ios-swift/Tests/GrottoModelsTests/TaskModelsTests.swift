import Foundation
import XCTest
@testable import GrottoModels

final class TaskModelsTests: XCTestCase {
    func testTaskListInputOmitsOptionalChatFilter() throws {
        let input = TaskListInput(serverID: "server_1")
        let data = try JSONEncoder().encode(input)
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )

        XCTAssertEqual(object["serverId"] as? String, "server_1")
        XCTAssertNil(object["chatId"])
    }

    func testTaskMutationInputsUseServerWireNames() throws {
        let input = TaskUpdateInput(
            serverID: "server_1",
            messageID: "message_1",
            expectedVersion: 3,
            patch: TaskUpdatePatch(status: .inReview)
        )
        let data = try JSONEncoder().encode(input)
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
        let patch = try XCTUnwrap(object["patch"] as? [String: Any])

        XCTAssertEqual(object["serverId"] as? String, "server_1")
        XCTAssertEqual(object["messageId"] as? String, "message_1")
        XCTAssertEqual(object["expectedVersion"] as? Int, 3)
        XCTAssertEqual(patch["status"] as? String, "in_review")
        XCTAssertNil(patch["priority"])
    }

    func testDecodesTaskListProjectionWithCanonicalMessageAndThread() throws {
        let item = try GrottoJSON.decoder().decode(
            TaskListItem.self,
            from: Data(
                """
                {"chatKind":"dm","chatName":null,"chatPeerUserId":"user_2",
                 "message":{"attachments":[],"author":{"kind":"human","userId":"user_1","profile":null},"chatId":"chat_1","content":"Review the mobile release","createdAt":"2026-01-01T00:00:00Z","id":"message_1","nonce":"nonce_1","runId":null,"sequence":8,"serverId":"server_1","task":null},
                 "task":{"assigneeAgentId":"agent_1","assigneeUserId":null,"chatId":"chat_1","claimedAt":null,"createdAt":"2026-01-01T00:00:00Z","createdByAgentId":null,"createdByUserId":"user_1","labels":[],"messageId":"message_1","number":4,"origin":"converted","priority":"urgent","status":"in_review","threadChatId":"thread_1","updatedAt":"2026-01-01T00:01:00Z","version":6},
                 "threadSummary":{"anchorMessageId":"message_1","followed":true,"latestReplyAt":"2026-01-01T00:02:00Z","recentReplies":[],"replyCount":2,"threadChatId":"thread_1","unreadCount":1}}
                """.utf8
            )
        )

        XCTAssertEqual(item.id, "message_1")
        XCTAssertEqual(item.task.status, .inReview)
        XCTAssertEqual(item.task.priority, .urgent)
        XCTAssertEqual(item.threadSummary.replyCount, 2)
        XCTAssertEqual(item.chatPeerUserID, "user_2")
    }
}
