import Foundation
import XCTest
@testable import GrottoTransport

final class ProfileAvatarModelsTests: XCTestCase {
    func testHumanProfileInputEncodesNullableDescriptionAndExactWireNames() throws {
        let input = UpdateHumanProfileInput(
            description: nil,
            displayName: "Zach Knickerbocker",
            handle: "zach",
            serverID: "srv_123"
        )
        let object = try jsonObject(input)

        XCTAssertEqual(Set(object.keys), ["description", "displayName", "handle", "serverId"])
        XCTAssertTrue(object["description"] is NSNull)
        XCTAssertEqual(object["displayName"] as? String, "Zach Knickerbocker")
        XCTAssertEqual(object["handle"] as? String, "zach")
        XCTAssertEqual(object["serverId"] as? String, "srv_123")
    }

    func testAgentProfileInputEncodesNullableDescriptionAndIDs() throws {
        let input = UpdateAgentProfileInput(
            agentID: "agent_cove",
            description: nil,
            displayName: "Cove",
            serverID: "srv_123"
        )
        let object = try jsonObject(input)

        XCTAssertEqual(Set(object.keys), ["agentId", "description", "displayName", "serverId"])
        XCTAssertEqual(object["agentId"] as? String, "agent_cove")
        XCTAssertTrue(object["description"] is NSNull)
        XCTAssertEqual(object["serverId"] as? String, "srv_123")
    }

    func testAvatarSetAndClearEncodeDiscriminatedTargets() throws {
        let set = SetAvatarInput(
            bytesBase64: "aGVsbG8=",
            mediaType: .png,
            serverID: "srv_123",
            target: .agent(agentID: "agent_1")
        )
        let setObject = try jsonObject(set)
        XCTAssertEqual(Set(setObject.keys), ["bytesBase64", "mediaType", "serverId", "target"])
        XCTAssertEqual(setObject["mediaType"] as? String, "image/png")
        XCTAssertEqual(
            setObject["target"] as? [String: String],
            ["agentId": "agent_1", "kind": "agent"]
        )

        let clear = ClearAvatarInput(serverID: "srv_123", target: .user)
        let clearObject = try jsonObject(clear)
        XCTAssertEqual(Set(clearObject.keys), ["serverId", "target"])
        XCTAssertEqual(clearObject["target"] as? [String: String], ["kind": "user"])
    }

    func testAvatarResponseDecodesSetAndClearShapes() throws {
        let set = try JSONDecoder().decode(
            Avatar.self,
            from: Data(#"{"avatarId":"avt_0123456789abcdef","avatarUrl":"/avatars/avt_0123456789abcdef"}"#.utf8)
        )
        XCTAssertEqual(set, Avatar(avatarID: "avt_0123456789abcdef", avatarURL: "/avatars/avt_0123456789abcdef"))

        let clear = try JSONDecoder().decode(Avatar.self, from: Data(#"{"avatarId":null,"avatarUrl":null}"#.utf8))
        XCTAssertEqual(clear, Avatar(avatarID: nil, avatarURL: nil))
    }

    private func jsonObject<Value: Encodable>(_ value: Value) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}
