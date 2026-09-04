import Foundation
import XCTest
@testable import GrottoModels

final class ChatMessageCauseTests: XCTestCase {
    func testDecodesATriggerCause() throws {
        let message = try decodeMessage(cause: """
        {
          "kind": "trigger",
          "automationId": "automation_1",
          "fireId": "fire_1",
          "title": "Deploy finished",
          "status": "active",
          "lastFiredAt": "2026-08-15T14:00:00.500Z",
          "fireCount": 3,
          "summary": "Runs after every production deploy.",
          "instruction": "Summarize the release.",
          "unknownFutureKey": {"nested": true}
        }
        """)

        let cause = try XCTUnwrap(message.cause)
        XCTAssertEqual(cause.kind, .trigger)
        XCTAssertEqual(cause.automationID, "automation_1")
        XCTAssertEqual(cause.fireID, "fire_1")
        XCTAssertEqual(cause.title, "Deploy finished")
        XCTAssertEqual(cause.status, "active")
        XCTAssertEqual(cause.lastFiredAt, GrottoISO8601.date(from: "2026-08-15T14:00:00.500Z"))
        XCTAssertEqual(cause.fireCount, 3)
        XCTAssertEqual(cause.summary, "Runs after every production deploy.")
        XCTAssertEqual(cause.instruction, "Summarize the release.")
    }

    /// A Trigger's anchor message is nullable on the Server, and a fire no
    /// longer carries a receipt message id. The phone models neither, so both
    /// must ride along as unknown keys without costing the reader the row.
    func testDecodesATriggerCauseWithANullAnchorAndNoReceipt() throws {
        let message = try decodeMessage(cause: """
        {
          "kind": "trigger",
          "automationId": "automation_3",
          "anchorMessageId": null,
          "fireId": "fire_3",
          "title": "Nightly digest",
          "status": "active",
          "lastFiredAt": null,
          "fireCount": 1,
          "summary": "Runs every night.",
          "instruction": null
        }
        """)

        let cause = try XCTUnwrap(message.cause)
        XCTAssertEqual(cause.kind, .trigger)
        XCTAssertEqual(cause.automationID, "automation_3")
        XCTAssertEqual(cause.fireID, "fire_3")
        XCTAssertNil(cause.lastFiredAt)
        XCTAssertEqual(message.content, "Please review this.")
    }

    /// A kind this build does not know keeps its wire string rather than
    /// costing the reader the message.
    func testDecodesAnUnknownCauseKind() throws {
        let message = try decodeMessage(cause: """
        {
          "kind": "webhook",
          "automationId": "automation_2",
          "fireId": "fire_2",
          "title": "Weekly self-review",
          "status": "paused",
          "lastFiredAt": null,
          "fireCount": 0,
          "summary": "Fires on an inbound webhook.",
          "instruction": null
        }
        """)

        let cause = try XCTUnwrap(message.cause)
        XCTAssertEqual(cause.kind, .unknown("webhook"))
        XCTAssertNil(cause.lastFiredAt)
        XCTAssertNil(cause.instruction)
    }

    func testAMalformedCauseLeavesTheMessageDecodable() throws {
        let missingFields = try decodeMessage(cause: #"{"kind":"trigger"}"#)
        XCTAssertNil(missingFields.cause)
        XCTAssertEqual(missingFields.content, "Please review this.")

        let wrongTypes = try decodeMessage(cause: #"{"kind":7,"automationId":[],"fireId":null}"#)
        XCTAssertNil(wrongTypes.cause)

        let notAnObject = try decodeMessage(cause: #""trigger""#)
        XCTAssertNil(notAnObject.cause)
    }

    func testAMessageWithoutACauseDecodesAsBefore() throws {
        let message = try decodeMessage(cause: nil)

        XCTAssertNil(message.cause)
        XCTAssertEqual(message.id, "message_1")
        XCTAssertEqual(message.sequence, 1)
        XCTAssertEqual(message.attachments.count, 1)
        if case let .human(_, userID) = message.author {
            XCTAssertEqual(userID, "user_1")
        } else {
            XCTFail("Expected a human author")
        }
    }

    private func decodeMessage(cause: String?) throws -> ChatMessage {
        let causeEntry = cause.map { "\"cause\": \($0)," } ?? ""
        let json = """
        {
          \(causeEntry)
          "attachments": [{"filename":"brief.pdf","id":"attachment_1","mediaType":"application/pdf","sizeBytes":42}],
          "author": {"kind":"human","userId":"user_1"},
          "chatId": "chat_1",
          "content": "Please review this.",
          "createdAt": "2026-08-15T14:00:00Z",
          "id": "message_1",
          "nonce": "nonce_1",
          "runId": null,
          "sequence": 1,
          "serverId": "server_1"
        }
        """
        return try GrottoJSON.decoder().decode(ChatMessage.self, from: Data(json.utf8))
    }
}
