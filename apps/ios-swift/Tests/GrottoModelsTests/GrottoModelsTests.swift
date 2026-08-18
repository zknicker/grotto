import Foundation
import XCTest
@testable import GrottoModels

final class GrottoModelsTests: XCTestCase {
    func testDecodesAgentAndMemberContracts() throws {
        let json = """
        {
          "availability": "working",
          "avatarUrl": "https://example.com/cove.png",
          "computerId": "computer_1",
          "createdAt": "2026-08-15T14:00:00.123Z",
          "createdByUserId": "user_1",
          "description": "Onboarding assistant",
          "desiredModelId": "model_1",
          "desiredRuntimeId": "runtime_1",
          "displayName": "Cove",
          "dmChatId": "chat_1",
          "effectiveModelId": "model_1",
          "effectiveReportedAt": "2026-08-15T14:00:01+00:00",
          "effectiveRuntimeId": "runtime_1",
          "factoryKind": "cove",
          "handle": "cove-agent",
          "id": "agent_1",
          "missingResources": [],
          "role": "admin",
          "serverId": "server_1",
          "status": "applied"
        }
        """

        let agent = try GrottoJSON.decoder().decode(AgentSummary.self, from: Data(json.utf8))

        XCTAssertEqual(agent.displayName, "Cove")
        XCTAssertEqual(agent.availability, .working)
        XCTAssertEqual(agent.serverID, "server_1")
        XCTAssertEqual(agent.effectiveReportedAt, GrottoISO8601.date(from: "2026-08-15T14:00:01+00:00"))

        let directory = try GrottoJSON.decoder().decode(
            MemberList.self,
            from: Data(
                """
                {"members":[{"avatarUrl":null,"description":null,"displayName":"Zach","email":"zach@example.com","handle":"zach","joinedAt":"2026-08-15T14:00:00Z","role":"owner","userId":"user_1"}],"viewerRole":"owner","viewerUserId":"user_1"}
                """.utf8
            )
        )

        XCTAssertEqual(directory.members.first?.id, "user_1")
        XCTAssertEqual(directory.viewerRole, .owner)
    }

    func testDecodesMessagePageAuthorsThreadsAndTasks() throws {
        let json = """
        {
          "messages": [
            {
              "attachments": [{"filename":"brief.pdf","id":"attachment_1","mediaType":"application/pdf","sizeBytes":42}],
              "author": {"kind":"human","userId":"user_1","profile":{"avatarUrl":null,"deleted":false,"description":null,"displayName":"Zach"}},
              "chatId":"chat_1","content":"Please review this.","createdAt":"2026-08-15T14:00:00Z","id":"message_1","nonce":"nonce_1","runId":null,"sequence":1,"serverId":"server_1",
              "task": {"assigneeAgentId":"agent_1","assigneeUserId":null,"chatId":"chat_1","claimedAt":null,"createdAt":"2026-08-15T14:00:00Z","createdByAgentId":null,"createdByUserId":"user_1","labels":[],"messageId":"message_1","number":1,"origin":"converted","priority":"high","status":"todo","threadChatId":"thread_1","updatedAt":"2026-08-15T14:00:00Z","version":1}
            }
          ],
          "nextBeforeSequence": null,
          "threads": [{"anchorMessageId":"message_1","followed":true,"latestReplyAt":"2026-08-15T14:01:00Z","recentReplies":[],"replyCount":1,"threadChatId":"thread_1","unreadCount":1}]
        }
        """

        let page = try GrottoJSON.decoder().decode(ChatMessagePage.self, from: Data(json.utf8))

        XCTAssertEqual(page.messages.count, 1)
        XCTAssertEqual(page.messages[0].attachments[0].mediaType, "application/pdf")
        XCTAssertEqual(page.messages[0].task?.status, .todo)
        XCTAssertEqual(page.threads[0].replyCount, 1)

        if case let .human(_, userID) = page.messages[0].author {
            XCTAssertEqual(userID, "user_1")
        } else {
            XCTFail("Expected a human author")
        }
    }

    func testMergesOlderMessagePagesInSequenceOrderAndDeduplicates() throws {
        let older = ChatMessagePage(
            messages: [
                try message(id: "message_1", sequence: 1, content: "one"),
                try message(id: "message_2", sequence: 2, content: "two"),
                try message(id: "message_3", sequence: 3, content: "stale overlap"),
            ],
            nextBeforeSequence: 1,
            threads: []
        )
        let newest = ChatMessagePage(
            messages: [
                try message(id: "message_3", sequence: 3, content: "authoritative overlap"),
                try message(id: "message_4", sequence: 4, content: "four"),
            ],
            nextBeforeSequence: 3,
            threads: []
        )

        let merged = newest.merging(older: older)

        XCTAssertEqual(merged.messages.map(\.id), ["message_1", "message_2", "message_3", "message_4"])
        XCTAssertEqual(merged.messages[2].content, "authoritative overlap")
        XCTAssertEqual(merged.nextBeforeSequence, 1)
    }

    func testDecodesLifecycleAndDurableChatEvents() throws {
        let lifecycleJSON = """
        {"agentId":"agent_1","chatId":"chat_1","emittedAt":"2026-08-15T14:00:00.000Z","runId":"run_1","serverId":"server_1","phase":"settled","outcome":"completed"}
        """
        let lifecycle = try GrottoJSON.decoder().decode(
            AgentLifecycleEvent.self,
            from: Data(lifecycleJSON.utf8)
        )
        XCTAssertEqual(lifecycle.phase, .settled)
        XCTAssertEqual(lifecycle.outcome, .completed)
        XCTAssertTrue(lifecycle.id.hasPrefix("run_1:settled:"))

        let eventJSON = """
        {"chatId":"chat_1","createdAt":"2026-08-15T14:00:00Z","cursor":"42","id":"event_1","messageId":"message_1","parentChatId":null,"sequence":2,"serverId":"server_1","type":"message.created"}
        """
        let event = try GrottoJSON.decoder().decode(ChatEvent.self, from: Data(eventJSON.utf8))
        XCTAssertEqual(event.type, .messageCreated)
        XCTAssertEqual(event.messageID, "message_1")
        XCTAssertEqual(event.cursor, "42")

        let lifecycleEvent = try GrottoJSON.decoder().decode(
            ChatEvent.self,
            from: Data(
                "{\"action\":\"deleted\",\"chatId\":\"chat_1\",\"createdAt\":\"2026-08-15T14:00:00Z\",\"cursor\":\"43\",\"id\":\"event_2\",\"parentChatId\":null,\"sequence\":0,\"serverId\":\"server_1\",\"type\":\"chat.lifecycle\"}".utf8
            )
        )
        XCTAssertEqual(lifecycleEvent.action, "deleted")
    }

    func testChatEventReplayStateAdvancesNumericallyAndDeduplicatesByID() {
        let date = Date(timeIntervalSince1970: 1)
        let first = ChatEvent(
            chatID: "chat_1",
            createdAt: date,
            cursor: "9",
            id: "event_9",
            parentChatID: nil,
            sequence: 1,
            serverID: "server_1",
            type: .messageCreated
        )
        let later = ChatEvent(
            chatID: "chat_1",
            createdAt: date,
            cursor: "10",
            id: "event_10",
            parentChatID: nil,
            sequence: 2,
            serverID: "server_1",
            type: .messageCreated
        )

        var replay = ChatEventReplayState(cursor: "8")
        XCTAssertTrue(replay.receive(first))
        XCTAssertFalse(replay.receive(first))
        XCTAssertTrue(replay.receive(later))
        XCTAssertEqual(replay.cursor, "10")
        replay.advance(to: "9")
        XCTAssertEqual(replay.cursor, "10")
    }

    func testChatEventReplayStateStillDispatchesAnEarlierGapAfterNewerLiveEvent() {
        let date = Date(timeIntervalSince1970: 1)
        func event(cursor: String) -> ChatEvent {
            ChatEvent(
                chatID: "chat_1",
                createdAt: date,
                cursor: cursor,
                id: "event_\(cursor)",
                parentChatID: nil,
                sequence: Int(cursor) ?? 0,
                serverID: "server_1",
                type: .messageCreated
            )
        }

        var replay = ChatEventReplayState(cursor: "5")
        XCTAssertTrue(replay.receive(event(cursor: "8")))
        XCTAssertTrue(replay.receive(event(cursor: "6")))
        XCTAssertEqual(replay.cursor, "8")
    }

    func testChatEventCursorNormalizesLeadingZeroes() {
        XCTAssertEqual(ChatEventCursor.later("009", "10"), "10")
        XCTAssertEqual(ChatEventCursor.later("0010", "9"), "10")
        XCTAssertEqual(ChatEventCursor.normalized("000"), "0")
    }

    func testDecodesServerComputerSnapshot() throws {
        let json = """
        {
          "architecture":"arm64",
          "createdAt":"2026-08-15T14:00:00Z",
          "health":"healthy",
          "id":"cmp_1234567890abcdef",
          "lastConnectedAt":"2026-08-15T14:01:00.123Z",
          "name":"Zach's MacBook Pro",
          "operatingSystem":"darwin",
          "productVersion":"1.4.0",
          "protocolVersion":2,
          "reportedInventory":{
            "name":"Zach's MacBook Pro",
            "runtimes":[{"id":"codex","label":"Codex","models":[{"id":"k3","label":"K3"}]}]
          },
          "updateDetail":null,
          "updateDownloadedBytes":null,
          "updateFailedPhase":null,
          "updatePhase":"idle",
          "updateActiveAgentCount":1,
          "updateTargetVersion":null,
          "updateTotalBytes":null,
          "updateUpdatedAt":"2026-08-15T14:01:00Z"
        }
        """

        let computer = try GrottoJSON.decoder().decode(
            ComputerSummary.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(computer.health, .healthy)
        XCTAssertEqual(computer.name, "Zach's MacBook Pro")
        XCTAssertEqual(computer.operatingSystem, "darwin")
        XCTAssertEqual(computer.reportedInventory?.runtimes.first?.models.first?.id, "k3")
        XCTAssertEqual(computer.updatePhase, .idle)
        XCTAssertEqual(computer.lastConnectedAt, GrottoISO8601.date(from: "2026-08-15T14:01:00.123Z"))
    }

    func testDecodesRetiredTaskSystemAuthorFromProductionHistory() throws {
        let json = """
        {"kind":"system","system":"task"}
        """

        let author = try GrottoJSON.decoder().decode(ChatAuthor.self, from: Data(json.utf8))

        XCTAssertEqual(author, .system(.task))
    }

    func testFixturesUseTheProductionDecoder() {
        XCTAssertEqual(GrottoPreviewFixtures.server.slug, "grotto")
        XCTAssertEqual(GrottoPreviewFixtures.agents.first?.displayName, "Cove")
        XCTAssertEqual(GrottoPreviewFixtures.memberDirectory.viewerUserID, "user_preview")
        XCTAssertEqual(GrottoPreviewFixtures.chats.first?.kind, .dm)
        XCTAssertEqual(GrottoPreviewFixtures.messages.first?.content, "Welcome to Grotto.")
    }

    private func message(id: String, sequence: Int, content: String) throws -> ChatMessage {
        let json = """
        {
          "attachments": [],
          "author": {"agentId":"agent_cove","kind":"agent","profile":null},
          "chatId":"chat_cove",
          "content":"\(content)",
          "createdAt":"2026-01-01T00:0\(sequence):00Z",
          "id":"\(id)",
          "nonce":"nonce_\(sequence)",
          "runId":null,
          "sequence":\(sequence),
          "serverId":"srv_preview",
          "task":null
        }
        """
        return try GrottoJSON.decoder().decode(ChatMessage.self, from: Data(json.utf8))
    }
}
