import Foundation
@testable import GrottoUI
import Testing

struct MessageAttachmentLayoutTests {
    @Test func givesASingleImageTheHeroTile() {
        let layout = MessageAttachmentLayout.resolve(
            attachments: [Self.image("a")],
            isPending: false
        )
        #expect(layout.style == .hero)
        #expect(layout.images.map(\.id) == ["a"])
        #expect(layout.files.isEmpty)
    }

    @Test func putsTwoOrMoreImagesInTheStrip() {
        for count in 2...6 {
            let layout = MessageAttachmentLayout.resolve(
                attachments: (0..<count).map { Self.image("image-\($0)") },
                isPending: false
            )
            #expect(layout.style == .strip)
            #expect(layout.images.count == count)
        }
    }

    @Test func keepsNonImagesAsFileRowsBesideTheStrip() {
        let layout = MessageAttachmentLayout.resolve(
            attachments: [Self.image("a"), Self.file("doc"), Self.image("b")],
            isPending: false
        )
        #expect(layout.style == .strip)
        #expect(layout.images.map(\.id) == ["a", "b"])
        #expect(layout.files.map(\.id) == ["doc"])
    }

    @Test func preservesTheSentOrderOfTheImages() {
        let layout = MessageAttachmentLayout.resolve(
            attachments: [Self.image("c"), Self.image("a"), Self.image("b")],
            isPending: false
        )
        #expect(layout.images.map(\.id) == ["c", "a", "b"])
    }

    /// A pending upload renders from its staged local file, so the strip a send
    /// shows is the strip the sent message keeps.
    @Test func drawsPendingImagesFromTheirStagedFiles() {
        let staged = MessageAttachmentLayout.resolve(
            attachments: [Self.image("a", staged: true), Self.image("b", staged: true)],
            isPending: true
        )
        #expect(staged.style == .strip)
        #expect(staged.images.count == 2)
    }

    @Test func leavesAPendingAttachmentWithNoStagedFileAsAFileRow() {
        let layout = MessageAttachmentLayout.resolve(
            attachments: [Self.image("a"), Self.image("b")],
            isPending: true
        )
        #expect(layout.images.isEmpty)
        #expect(layout.files.map(\.id) == ["a", "b"])
    }

    @Test func dropsAnImageWhoseDecodeFailedBackToItsFileRow() {
        let layout = MessageAttachmentLayout.resolve(
            attachments: [Self.image("a"), Self.image("b")],
            isPending: false,
            failedImageIDs: ["b"]
        )
        #expect(layout.style == .hero)
        #expect(layout.images.map(\.id) == ["a"])
        #expect(layout.files.map(\.id) == ["b"])
    }

    private static func image(_ id: String, staged: Bool = false) -> MessageAttachmentPresentation {
        MessageAttachmentPresentation(
            id: id,
            filename: "\(id).png",
            mediaType: "image/png",
            sizeBytes: 1_024,
            localURL: staged ? URL(fileURLWithPath: "/tmp/\(id).png") : nil
        )
    }

    private static func file(_ id: String) -> MessageAttachmentPresentation {
        MessageAttachmentPresentation(
            id: id,
            filename: "\(id).pdf",
            mediaType: "application/pdf",
            sizeBytes: 2_048,
            localURL: nil
        )
    }
}
