import Foundation

/// How a message's attachments are laid out: which of them render as pictures,
/// whether those pictures take the hero tile or the strip, and which keep the
/// file row.
///
/// One image is the subject of the message and gets the hero tile. Two or more
/// are a set, and a set reads as a strip. Everything that is not a renderable
/// image — a PDF, a video, an image whose decode failed, an image still being
/// staged with no local file to draw yet — keeps its file row, below the
/// pictures.
enum MessageAttachmentLayout {
    enum Style: Equatable {
        case hero
        case strip
    }

    struct Resolved: Equatable {
        let images: [MessageAttachmentPresentation]
        let files: [MessageAttachmentPresentation]

        var style: Style { images.count > 1 ? .strip : .hero }
    }

    /// A pending upload draws from its staged local file, so an attachment
    /// without one has nothing to render yet and keeps the file row until the
    /// sent message arrives.
    static func resolve(
        attachments: [MessageAttachmentPresentation],
        isPending: Bool,
        failedImageIDs: Set<String> = []
    ) -> Resolved {
        var images: [MessageAttachmentPresentation] = []
        var files: [MessageAttachmentPresentation] = []
        for attachment in attachments {
            let rendersAsImage = attachment.isImage
                && (!isPending || attachment.localURL != nil)
                && !failedImageIDs.contains(attachment.id)
            if rendersAsImage {
                images.append(attachment)
            } else {
                files.append(attachment)
            }
        }
        return Resolved(images: images, files: files)
    }
}
