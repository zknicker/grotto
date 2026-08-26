@testable import GrottoUI
import XCTest

final class AgentProfilePresentationTests: XCTestCase {
    func testProjectsRoleRuntimeAndModelAsOneDetailList() {
        let profile = AgentProfilePresentation(
            handle: "cove",
            description: "Onboards new Servers.",
            role: "Owner",
            runtime: "Claude Code",
            model: "claude-opus-4"
        )

        XCTAssertEqual(profile.detailFields.map(\.title), ["Role", "Runtime", "Model"])
        XCTAssertEqual(profile.detailFields.map(\.value), ["Owner", "Claude Code", "claude-opus-4"])
    }

    func testFieldsTheServerNeverFilledInDropTheirRow() {
        let profile = AgentProfilePresentation(role: "Agent", runtime: "   ", model: "")

        XCTAssertEqual(profile.detailFields.map(\.title), ["Role"])
        XCTAssertNil(profile.about)
        XCTAssertNil(profile.displayHandle)
    }

    func testHandleGetsExactlyOneAtSign() {
        XCTAssertEqual(AgentProfilePresentation(handle: "cove").displayHandle, "@cove")
        XCTAssertEqual(AgentProfilePresentation(handle: " @cove ").displayHandle, "@cove")
    }

    func testAboutTrimsAndTreatsBlankDescriptionAsNothingToShow() {
        XCTAssertEqual(AgentProfilePresentation(description: "  Keeps it tight. ").about, "Keeps it tight.")
        XCTAssertNil(AgentProfilePresentation(description: "\n \t").about)
    }
}

final class ChatDetailsRouteTests: XCTestCase {
    /// The route carries the Agent itself, so the pushed profile never has to
    /// re-resolve an id against a Chat list that may have moved on.
    func testAgentProfileRouteIsIdentifiedByItsAgent() {
        let cove = ChatFixtures.cove
        let other = AgentPresentation(id: "agent-tiny", name: "Tiny", avatarURL: nil, presence: .working)

        XCTAssertEqual(ChatDetailsRoute.agentProfile(cove), .agentProfile(cove))
        XCTAssertNotEqual(ChatDetailsRoute.agentProfile(cove), .agentProfile(other))
    }
}
