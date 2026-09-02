import CoreGraphics
import Foundation
import ImageIO
import SwiftUI

/// A decoded, downsampled attachment image ready for display.
struct AttachmentThumbnail {
    let image: Image
    let size: CGSize
    /// Classified once, here, from the bytes this decode already had in hand,
    /// so the viewer's first frame carries the right ground instead of opening
    /// on black and stepping to a checkerboard once its own decode lands.
    /// A staged local file has no viewer page, so it keeps the default.
    var backdrop: AttachmentImageBackdrop = .opaque
}

/// An immutable decoded bitmap handed across executors. `CGImage` is
/// immutable; the wrapper exists only because the SDK does not declare it
/// `Sendable`.
struct DecodedAttachmentBitmap: @unchecked Sendable {
    let cgImage: CGImage

    var pixelCost: Int { cgImage.width * cgImage.height * 4 }
}

/// ImageIO thumbnailing shared by every attachment surface. The function is
/// nonisolated async so the decode always runs on the concurrent pool, never
/// the main actor.
enum AttachmentImageDecoder {
    static func decode(at url: URL, maxPixelSize: CGFloat) async -> DecodedAttachmentBitmap? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
        ]
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            return nil
        }
        return DecodedAttachmentBitmap(cgImage: cgImage)
    }
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

    init() {
        cache.countLimit = 80
        cache.totalCostLimit = 64 * 1024 * 1024
    }

    func thumbnail(for attachmentID: String) -> AttachmentThumbnail? {
        cache.object(forKey: attachmentID as NSString)?.thumbnail
    }

    func store(
        _ thumbnail: AttachmentThumbnail,
        for attachmentID: String,
        decodedPixelCost: Int,
        stagedContentKey: String? = nil
    ) {
        let box = ThumbnailBox(thumbnail: thumbnail, pixelCost: decodedPixelCost)
        cache.setObject(box, forKey: attachmentID as NSString, cost: decodedPixelCost)
        if let stagedContentKey {
            cache.setObject(box, forKey: stagedContentKey as NSString, cost: decodedPixelCost)
        }
    }

    /// A pending upload decodes from its staged local file under the composer
    /// attachment id, but the durable message arrives under a fresh Server
    /// attachment id with no local file. Matching on filename + byte size lets
    /// the retired row's replacement render the identical bitmap on its first
    /// frame instead of flashing the placeholder and re-downloading.
    func adoptStagedThumbnail(
        filename: String,
        sizeBytes: Int,
        as attachmentID: String
    ) -> AttachmentThumbnail? {
        let key = Self.stagedContentKey(filename: filename, sizeBytes: sizeBytes)
        guard let box = cache.object(forKey: key as NSString) else { return nil }
        cache.setObject(box, forKey: attachmentID as NSString, cost: box.pixelCost)
        return box.thumbnail
    }

    static func stagedContentKey(filename: String, sizeBytes: Int) -> String {
        "staged-content:\(sizeBytes):\(filename)"
    }

    private final class ThumbnailBox {
        let thumbnail: AttachmentThumbnail
        let pixelCost: Int

        init(thumbnail: AttachmentThumbnail, pixelCost: Int) {
            self.thumbnail = thumbnail
            self.pixelCost = pixelCost
        }
    }
}
