import Foundation
import XCTest
@testable import GrottoModels

final class PreparedActionModelsTests: XCTestCase {
    func testDecodesTypedPreparedCreateActionFromCanonicalMessageProjection() throws {
        let message = try GrottoJSON.decoder().decode(
            ChatMessage.self,
            from: Data(Self.pendingMessageJSON.utf8)
        )

        guard case let .createAgent(action) = message.preparedAction else {
            return XCTFail("Expected a typed Agent creation action")
        }
        XCTAssertEqual(action.status, .pending)
        XCTAssertEqual(action.proposal.name, "Moss")
        XCTAssertEqual(action.proposal.avatar.mediaType, .png)
        XCTAssertEqual(action.proposal.computer?.computerID, "computer_1")
        XCTAssertNil(action.result)
    }

    func testFuturePreparedActionKindDecodesAsInertLifecycleProjection() throws {
        let json = Self.pendingMessageJSON.replacingOccurrences(
            of: #""kind":"agent:create""#,
            with: #""kind":"channel:archive""#
        )
        let message = try GrottoJSON.decoder().decode(ChatMessage.self, from: Data(json.utf8))

        guard case let .unsupported(action) = message.preparedAction else {
            return XCTFail("Expected an unsupported action")
        }
        XCTAssertEqual(action.kind, "channel:archive")
        XCTAssertEqual(action.status, .pending)
    }

    func testDecodesPreparedActionRealtimeHintWithoutProposalPayload() throws {
        let event = try GrottoJSON.decoder().decode(
            ChatEvent.self,
            from: Data(
                #"{"actionId":"act_1234567890abcdef","chatId":"chat_1","createdAt":"2026-08-26T15:00:00Z","cursor":"8","id":"evt_8","messageId":"msg_1","parentChatId":null,"sequence":4,"serverId":"srv_1","status":"executed","type":"prepared-action.updated"}"#.utf8
            )
        )

        XCTAssertEqual(event.type, .preparedActionUpdated)
        XCTAssertEqual(event.actionID, "act_1234567890abcdef")
        XCTAssertEqual(event.status, .executed)
        XCTAssertEqual(event.messageID, "msg_1")
    }

    func testCommitInputKeepsNullableDescriptionAndOmitsUnchangedAvatar() throws {
        let input = PreparedActionCommitInput(
            actionID: "act_1234567890abcdef",
            avatar: nil,
            computerID: "computer_1",
            description: nil,
            displayName: "Moss",
            handle: "moss",
            modelID: "model_1",
            reasoningEffort: .medium,
            runtimeID: "runtime_1",
            serverID: "srv_1"
        )
        let data = try JSONEncoder().encode(input)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertNil(object["avatar"])
        XCTAssertTrue(object["description"] is NSNull)
        XCTAssertEqual(object["actionId"] as? String, "act_1234567890abcdef")
        XCTAssertEqual(object["reasoningEffort"] as? String, "medium")
    }

    private static let pendingMessageJSON = #"{"attachments":[],"author":{"agentId":"agent_cove","kind":"agent","profile":{"avatarUrl":null,"deleted":false,"description":"Guide","displayName":"Cove"}},"chatId":"chat_1","content":"","createdAt":"2026-08-26T15:00:00Z","id":"msg_1","nonce":"nonce_1","preparedAction":{"chatId":"chat_1","createdAt":"2026-08-26T15:00:00Z","executedAt":null,"executedByUserId":null,"id":"act_1234567890abcdef","kind":"agent:create","messageId":"msg_1","proposal":{"avatar":{"byteSize":42,"id":"pam_1234567890abcdef","mediaType":"image/png","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","url":"/api/prepared-action-media/pam_1234567890abcdef"},"computer":{"computerId":"computer_1","kind":"suggested","label":"Mac mini"},"description":"Keeps the garden tidy","draftHint":"Review before creating","kind":"agent:create","name":"Moss"},"proposerAgentId":"agent_cove","result":null,"status":"pending","supersededAt":null,"supersededByActionId":null},"runId":"run_1","sequence":4,"serverId":"srv_1","task":null}"#
}
