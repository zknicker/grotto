import ImageIO
import SwiftUI

/// Renders a sent image attachment as an inline media tile instead of a file
/// row. Downloads through the authenticated `onOpen` closure (the same path
/// Quick Look uses), decodes a downsampled bitmap sized for the tile, and
/// caches the result in `AttachmentImageCache` so scrolling and re-renders
/// don't re-download or re-decode. Reports failure so the caller can fall
/// back to the standard file row.
struct AttachmentImageTile: View {
    let attachment: MessageAttachmentPresentation
    let onOpen: (MessageAttachmentPresentation) async throws -> URL
    let onFailure: () -> Void

    @State private var thumbnail: AttachmentThumbnail?

    var body: some View {
        Group {
            if let thumbnail {
                thumbnail.image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: thumbnail.size.width, height: thumbnail.size.height)
            } else {
                Rectangle()
                    .fill(.quaternary)
                    .frame(
                        width: AttachmentImageTileSize.placeholderSize.width,
                        height: AttachmentImageTileSize.placeholderSize.height
                    )
            }
        }
        .clipShape(.rect(cornerRadius: 14))
        .task(id: attachment.id) {
            await loadThumbnail()
        }
    }

    @MainActor
    private func loadThumbnail() async {
        if let cached = AttachmentImageCache.shared.thumbnail(for: attachment.id) {
            thumbnail = cached
            return
        }
        do {
            let url = try await onOpen(attachment)
            // A fresh download lands in an isolated temp directory owned by
            // this call; the decoded bitmap is cached, so the file itself is
            // no longer needed. `localURL` staged files belong to the
            // composer and must not be deleted here.
            let downloadedDirectory = attachment.localURL == nil ? url.deletingLastPathComponent() : nil
            defer {
                if let downloadedDirectory {
                    try? FileManager.default.removeItem(at: downloadedDirectory)
                }
            }
            guard let decoded = Self.decodeThumbnail(at: url) else {
                onFailure()
                return
            }
            AttachmentImageCache.shared.store(
                decoded.thumbnail,
                for: attachment.id,
                decodedPixelCost: decoded.pixelCost
            )
            thumbnail = decoded.thumbnail
        } catch is CancellationError {
            // The tile disappeared or the transfer was superseded; no error UI needed.
        } catch {
            onFailure()
        }
    }

    private static func decodeThumbnail(at url: URL) -> (thumbnail: AttachmentThumbnail, pixelCost: Int)? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let maxPixelSize = AttachmentImageTileSize.maxDimension * 2
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
        ]
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            return nil
        }
        let size = AttachmentImageTileSize.fitted(pixelWidth: cgImage.width, pixelHeight: cgImage.height)
        let thumbnail = AttachmentThumbnail(
            image: Image(decorative: cgImage, scale: 1, orientation: .up),
            size: size
        )
        return (thumbnail, cgImage.width * cgImage.height * 4)
    }
}
