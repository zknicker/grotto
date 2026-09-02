import GrottoModels

/// The one place a Server Thread summary becomes the anchor's preview.
///
/// The App layer owns actor resolution — names, faces, and presence live in
/// its directories — so it supplies that and this keeps the Server's own
/// order and cap for the recent replies. A reply whose author cannot be
/// resolved is dropped rather than drawn as an unknown face.
public enum ThreadPreviewProjection {
    public static func presentation(
        for summary: ThreadSummary,
        resolveAuthor: (ThreadReplyPreview) -> MessageAuthorPresentation?
    ) -> ThreadPreviewPresentation {
        ThreadPreviewPresentation(
            threadChatID: summary.threadChatID,
            replyCount: summary.replyCount,
            unreadCount: summary.unreadCount,
            recentReplies: summary.recentReplies.compactMap { reply in
                guard let author = resolveAuthor(reply) else { return nil }
                return ThreadReplyPresentation(
                    id: reply.id,
                    author: author,
                    content: reply.content,
                    createdAt: reply.createdAt
                )
            }
        )
    }

    /// The count as the ingress says it. A task ingress with no replies yet
    /// keeps just the chevron; the row is still the way in, but "0 replies"
    /// is noise next to the task summary.
    public static func replyLabel(replyCount: Int, hasTask: Bool) -> String? {
        guard replyCount > 0 else {
            return hasTask ? nil : "Reply in thread"
        }
        return replyCount == 1 ? "1 reply" : "\(replyCount) replies"
    }
}
