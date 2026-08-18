import Foundation
import XCTest
@testable import GrottoModels

final class ChatReadModelsTests: XCTestCase {
    func testReadInputUsesServerContractWireNames() throws {
        let input = ChatReadInput(chatID: "chat_product", sequence: 42, serverID: "srv_main")
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(input)) as? [String: Any]
        )

        XCTAssertEqual(Set(object.keys), ["chatId", "sequence", "serverId"])
        XCTAssertEqual(object["chatId"] as? String, "chat_product")
        XCTAssertEqual(object["sequence"] as? Int, 42)
        XCTAssertEqual(object["serverId"] as? String, "srv_main")
    }

    func testReadReceiptDecodesNullableEventCursor() throws {
        let receipt = try JSONDecoder().decode(
            ChatReadReceipt.self,
            from: Data(#"{"chatId":"chat_product","eventCursor":null,"sequence":42,"serverId":"srv_main"}"#.utf8)
        )

        XCTAssertEqual(receipt, ChatReadReceipt(
            chatID: "chat_product",
            eventCursor: nil,
            sequence: 42,
            serverID: "srv_main"
        ))
    }
}
