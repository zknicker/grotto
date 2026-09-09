import Foundation
import XCTest
@testable import GrottoModels

final class MentionOptionModelsTests: XCTestCase {
    func testDecodesChannelMentionOption() throws {
        let json = """
        {
          "description": "Channel",
          "id": "chat://cht_product",
          "insertText": "#product",
          "kind": "chat",
          "label": "product",
          "metadata": { "chatColor": "violet", "chatIcon": "RocketIcon" },
          "projection": "chat-reference",
          "sourceLabel": "Channels"
        }
        """

        let option = try GrottoJSON.decoder().decode(MentionOption.self, from: Data(json.utf8))

        XCTAssertEqual(option.kind, .chat)
        XCTAssertEqual(option.id, "chat://cht_product")
        XCTAssertEqual(option.insertText, "#product")
        XCTAssertEqual(option.metadata?.chatColor, "violet")
        XCTAssertEqual(option.metadata?.chatIcon, "RocketIcon")
        XCTAssertNil(option.metadata?.userHandle)

        // A human option carries different metadata keys and no appearance.
        let human = try GrottoJSON.decoder().decode(
            MentionOption.self,
            from: Data(json
                .replacingOccurrences(of: "\"kind\": \"chat\"", with: "\"kind\": \"user\"")
                .replacingOccurrences(
                    of: "{ \"chatColor\": \"violet\", \"chatIcon\": \"RocketIcon\" }",
                    with: "{ \"userHandle\": \"ada\", \"userAvatarUrl\": null }"
                ).utf8)
        )

        XCTAssertEqual(human.kind, .user)
        XCTAssertEqual(human.metadata?.userHandle, "ada")
        XCTAssertNil(human.metadata?.chatIcon)
    }

    func testDecodesSkillMentionOptionAndToleratesAnUnknownKind() throws {
        let json = """
        {
          "options": [
            {
              "description": "Browser automation CLI for AI agents.",
              "id": "skill://agent-browser",
              "insertText": "agent-browser",
              "kind": "skill",
              "label": "agent-browser",
              "metadata": { "description": "Browser automation CLI for AI agents." },
              "projection": "skill-activation",
              "sourceLabel": "Skills"
            },
            {
              "description": null,
              "id": "zzz://thing",
              "insertText": "thing",
              "kind": "zzz",
              "label": "thing",
              "projection": "zzz-projection",
              "sourceLabel": "Things"
            }
          ]
        }
        """

        let roster = try GrottoJSON.decoder().decode(MentionOptions.self, from: Data(json.utf8))

        XCTAssertEqual(roster.options.count, 2)
        let skill = try XCTUnwrap(roster.options.first)
        XCTAssertEqual(skill.kind, .skill)
        XCTAssertEqual(skill.insertText, "agent-browser")
        XCTAssertEqual(skill.metadata?.description, "Browser automation CLI for AI agents.")

        // An unknown kind costs its own row, never the whole roster.
        XCTAssertNil(roster.options.last?.kind)
        XCTAssertEqual(roster.options.last?.label, "thing")
    }
}
