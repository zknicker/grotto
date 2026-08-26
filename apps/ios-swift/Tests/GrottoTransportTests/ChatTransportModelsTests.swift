import Foundation
import XCTest
@testable import GrottoTransport

final class ChatTransportModelsTests: XCTestCase {
    func testAgentDMSendUsesImplicitTargetWithoutAChatID() throws {
        let input = SendAgentDMInput(
            agentID: "agt_cove",
            content: "Hello",
            nonce: "nonce-1",
            serverID: "srv_1"
        )
        let object = try jsonObject(input)

        XCTAssertEqual(
            Set(object.keys),
            ["agentId", "attachmentIds", "content", "nonce", "serverId", "targetKind"]
        )
        XCTAssertNil(object["chatId"])
        XCTAssertEqual(object["agentId"] as? String, "agt_cove")
        XCTAssertEqual(object["targetKind"] as? String, "agent-dm")
    }

    func testMentionInputsDistinguishDurableChatAndImplicitDM() throws {
        let chat = try jsonObject(ChatMentionOptionsInput(chatID: "chat_1", serverID: "srv_1"))
        let dm = try jsonObject(AgentDMMentionOptionsInput(agentID: "agt_1", serverID: "srv_1"))

        XCTAssertEqual(chat["chatId"] as? String, "chat_1")
        XCTAssertNil(chat["targetKind"])
        XCTAssertEqual(dm["agentId"] as? String, "agt_1")
        XCTAssertEqual(dm["targetKind"] as? String, "agent-dm")
    }

    private func jsonObject<Value: Encodable>(_ value: Value) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}
