import Foundation
import GrottoModels
@testable import GrottoUI
import Testing

struct ThreadPreviewPresentationTests {
    @Test func keepsEveryRecentReplyInServerOrder() {
        let preview = ThreadPreviewProjection.presentation(for: summary(replyIDs: ["a", "b", "c"])) {
            MessageAuthorPresentation(id: $0.authorUserID ?? "unknown", name: "Zach", avatarURL: nil)
        }

        #expect(preview.threadChatID == "thread_1")
        #expect(preview.replyCount == 3)
        #expect(preview.unreadCount == 1)
        #expect(preview.recentReplies.map(\.id) == ["a", "b", "c"])
        #expect(preview.recentReplies.map(\.content) == ["reply a", "reply b", "reply c"])
    }

    @Test func dropsRepliesWhoseAuthorTheDirectoriesCannotResolve() {
        let preview = ThreadPreviewProjection.presentation(for: summary(replyIDs: ["a", "b"])) { reply in
            reply.id == "a"
                ? MessageAuthorPresentation(id: "zach", name: "Zach", avatarURL: nil)
                : nil
        }

        #expect(preview.recentReplies.map(\.id) == ["a"])
    }

    @Test func yieldsNoRowsWhenTheServerSentNoRecentReplies() {
        let preview = ThreadPreviewProjection.presentation(for: summary(replyIDs: [])) { _ in
            MessageAuthorPresentation(id: "zach", name: "Zach", avatarURL: nil)
        }

        #expect(preview.recentReplies.isEmpty)
    }

    @Test func labelsTheReplyCount() {
        #expect(ThreadPreviewProjection.replyLabel(replyCount: 0, hasTask: false) == "Reply in thread")
        #expect(ThreadPreviewProjection.replyLabel(replyCount: 0, hasTask: true) == nil)
        #expect(ThreadPreviewProjection.replyLabel(replyCount: 1, hasTask: false) == "1 reply")
        #expect(ThreadPreviewProjection.replyLabel(replyCount: 2, hasTask: false) == "2 replies")
        #expect(ThreadPreviewProjection.replyLabel(replyCount: 2, hasTask: true) == "2 replies")
    }

    /// The Server sends recent replies oldest first, so the fixture is written
    /// in that order and the projection must not reorder or trim it.
    private func summary(replyIDs: [String]) -> ThreadSummary {
        let replies = replyIDs.map { id in
            """
            {"authorAgentId":null,"authorUserId":"user_1","content":"reply \(id)",\
            "createdAt":"2026-01-01T00:00:00Z","id":"\(id)"}
            """
        }
        let json = """
        {"anchorMessageId":"message_1","followed":true,"latestReplyAt":"2026-01-01T00:00:00Z",\
        "recentReplies":[\(replies.joined(separator: ","))],"replyCount":\(replyIDs.count),\
        "threadChatId":"thread_1","unreadCount":1}
        """
        do {
            return try GrottoJSON.decoder().decode(ThreadSummary.self, from: Data(json.utf8))
        } catch {
            preconditionFailure("Invalid thread summary fixture: \(error)")
        }
    }
}
