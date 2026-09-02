import Foundation
@testable import GrottoUI
import Testing

struct AttachmentImagePagesTests {
    @Test func pagesEveryImageInTranscriptOrder() {
        let pages = AttachmentImagePages.pages(in: [
            message("m1", attachments: [image("a"), file("doc")]),
            message("m2", attachments: []),
            message("m3", attachments: [image("b"), image("c")]),
        ])

        #expect(pages.map(\.id) == ["a", "b", "c"])
    }

    /// A pending message's attachments have no Server bytes to resolve, and the
    /// tile they would page to is about to be replaced by the sent row.
    @Test func leavesOutPendingMessages() {
        let pages = AttachmentImagePages.pages(in: [
            message("m1", attachments: [image("a")]),
            message("m2", attachments: [image("uploading")], isPending: true),
            message("m3", attachments: [image("b")]),
        ])

        #expect(pages.map(\.id) == ["a", "b"])
    }

    @Test func opensOnTheTappedImage() {
        let pages = AttachmentImagePages.pages(in: [
            message("m1", attachments: [image("a"), image("b"), image("c")]),
        ])

        #expect(AttachmentImagePages.startIndex(of: "a", in: pages) == 0)
        #expect(AttachmentImagePages.startIndex(of: "c", in: pages) == 2)
    }

    @Test func hasNoStartForAnImageTheTranscriptDoesNotHold() {
        let pages = AttachmentImagePages.pages(in: [message("m1", attachments: [image("a")])])

        #expect(AttachmentImagePages.startIndex(of: "gone", in: pages) == nil)
        #expect(AttachmentImagePages.startIndex(of: "a", in: []) == nil)
    }

    private func message(
        _ id: String,
        attachments: [MessageAttachmentPresentation],
        isPending: Bool = false
    ) -> MessagePresentation {
        MessagePresentation(
            id: id,
            author: MessageAuthorPresentation(id: "author", name: "Blippy", avatarURL: nil),
            content: "",
            createdAt: Date(timeIntervalSince1970: 0),
            attachments: attachments,
            isPending: isPending
        )
    }

    private func image(_ id: String) -> MessageAttachmentPresentation {
        MessageAttachmentPresentation(
            id: id,
            filename: "\(id).png",
            mediaType: "image/png",
            sizeBytes: 1024
        )
    }

    private func file(_ id: String) -> MessageAttachmentPresentation {
        MessageAttachmentPresentation(
            id: id,
            filename: "\(id).pdf",
            mediaType: "application/pdf",
            sizeBytes: 2048
        )
    }
}
