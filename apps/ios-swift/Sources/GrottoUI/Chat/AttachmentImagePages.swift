import Foundation

/// The image viewer's page list, derived from the transcript a screen is
/// already showing.
///
/// Opening one image opens the chat's images: the viewer pages through every
/// image the transcript holds, in the order they were sent. A pending message's
/// attachments are excluded because they have no Server bytes to resolve yet,
/// and the tile they would page to is about to be replaced by the sent row.
enum AttachmentImagePages {
    static func pages(in messages: [MessagePresentation]) -> [MessageAttachmentPresentation] {
        messages
            .filter { !$0.isPending }
            .flatMap(\.attachments)
            .filter(\.isImage)
    }

    /// Where the viewer opens. A tapped tile whose attachment is not in the
    /// page list — a race with a page reload, or a row that left the
    /// transcript — has no viewer to open.
    static func startIndex(
        of attachmentID: String,
        in pages: [MessageAttachmentPresentation]
    ) -> Int? {
        pages.firstIndex { $0.id == attachmentID }
    }
}
