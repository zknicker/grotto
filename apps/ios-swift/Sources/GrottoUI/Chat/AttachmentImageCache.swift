import CoreGraphics
import SwiftUI

/// A decoded, downsampled attachment image ready for display.
struct AttachmentThumbnail {
    let image: Image
    let size: CGSize
}

/// In-memory cache of decoded attachment thumbnails keyed by attachment id.
///
/// Sent attachments have no local file, so every inline image tile downloads
/// through the authenticated attachment route and decodes a downsampled
/// bitmap. This cache keeps re-renders and scrolling from re-downloading and
/// re-decoding the same attachment. Bounded by both entry count and decoded
/// pixel bytes so a long timeline of large photos cannot grow unbounded.
@MainActor
final class AttachmentImageCache {
    static let shared = AttachmentImageCache()

    private let cache = NSCache<NSString, ThumbnailBox>()

    private init() {
        cache.countLimit = 80
        cache.totalCostLimit = 64 * 1024 * 1024
    }

    func thumbnail(for attachmentID: String) -> AttachmentThumbnail? {
        cache.object(forKey: attachmentID as NSString)?.thumbnail
    }

    func store(_ thumbnail: AttachmentThumbnail, for attachmentID: String, decodedPixelCost: Int) {
        cache.setObject(
            ThumbnailBox(thumbnail: thumbnail),
            forKey: attachmentID as NSString,
            cost: decodedPixelCost
        )
    }

    private final class ThumbnailBox {
        let thumbnail: AttachmentThumbnail
        init(thumbnail: AttachmentThumbnail) { self.thumbnail = thumbnail }
    }
}
