@testable import GrottoUI
import XCTest

final class ServerSearchTests: XCTestCase {
    func testEmptyQueryMatchesNothing() {
        XCTAssertTrue(ServerSearch.matchingChats(ChatFixtures.chats, query: "").isEmpty)
        XCTAssertTrue(ServerSearch.matchingChats(ChatFixtures.chats, query: "   ").isEmpty)
    }

    func testMatchesChannelsAndAgentsRegardlessOfCase() {
        let titles = ServerSearch.matchingChats(ChatFixtures.chats, query: "PRODUCT").map(\.title)
        XCTAssertEqual(titles, ["product"])

        XCTAssertEqual(
            ServerSearch.matchingChats(ChatFixtures.chats, query: "cove").map(\.title),
            ["Cove"]
        )
    }

    func testPrefixMatchesSortAheadOfContainedMatches() {
        let chats = [
            ChatPresentation(id: "a", title: "onboarding-owner", kind: .channel),
            ChatPresentation(id: "b", title: "owner-notes", kind: .channel),
        ]

        XCTAssertEqual(
            ServerSearch.matchingChats(chats, query: "owner").map(\.id),
            ["b", "a"]
        )
    }
}
