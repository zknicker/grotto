import SwiftUI

/// Renders an image attachment as an inline media tile instead of a file row.
///
/// Sent attachments download through the authenticated `onOpen` closure (the
/// same path Quick Look uses); pending attachments decode straight from their
/// staged local file. Every decode is downsampled off the main actor and
/// cached in `AttachmentImageCache`, and `body` reads the cache synchronously,
/// so a cached tile — including one recycled by a lazy stack — renders fully
/// formed on its first frame. Reports failure so the caller can fall back to
/// the standard file row.
struct AttachmentImageTile: View {
    let attachment: MessageAttachmentPresentation
    let onOpen: (MessageAttachmentPresentation) async throws -> URL
    let onFailure: () -> Void

    /// Bumped when an async decode lands so `body` re-reads the cache.
    @State private var loadedAttachmentID: String?

    var body: some View {
        let thumbnail = Self.cachedThumbnail(for: attachment)
        let needsLoad = thumbnail == nil
        Group {
            if let thumbnail {
                thumbnail.image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
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
            guard needsLoad else { return }
            await loadThumbnail()
        }
    }

    /// Resolves a renderable thumbnail without leaving the main actor: the
    /// tile's own cache entry first, then the staged-file cache for pending
    /// attachments, then the staged-content bridge that lets a just-sent
    /// attachment reuse the bitmap its pending row already decoded.
    @MainActor
    static func cachedThumbnail(for attachment: MessageAttachmentPresentation) -> AttachmentThumbnail? {
        if let hit = AttachmentImageCache.shared.thumbnail(for: attachment.id) { return hit }
        if let localURL = attachment.localURL {
            guard let entry = LocalAttachmentImageCache.shared.entry(for: localURL) else { return nil }
            let thumbnail = AttachmentThumbnail(
                image: entry.image,
                size: AttachmentImageTileSize.fitted(
                    pixelWidth: entry.pixelWidth,
                    pixelHeight: entry.pixelHeight
                )
            )
            AttachmentImageCache.shared.store(
                thumbnail,
                for: attachment.id,
                decodedPixelCost: entry.pixelWidth * entry.pixelHeight * 4,
                stagedContentKey: AttachmentImageCache.stagedContentKey(
                    filename: attachment.filename,
                    sizeBytes: attachment.sizeBytes
                )
            )
            return thumbnail
        }
        return AttachmentImageCache.shared.adoptStagedThumbnail(
            filename: attachment.filename,
            sizeBytes: attachment.sizeBytes,
            as: attachment.id
        )
    }

    @MainActor
    private func loadThumbnail() async {
        if let localURL = attachment.localURL {
            guard await LocalAttachmentImageCache.shared.load(url: localURL) != nil else {
                onFailure()
                return
            }
            // The next body pass promotes the staged entry into
            // AttachmentImageCache via `cachedThumbnail`.
            loadedAttachmentID = attachment.id
            return
        }
        do {
            let url = try await onOpen(attachment)
            // A fresh download lands in an isolated temp directory owned by
            // this call; the decoded bitmap is cached, so the file itself is
            // no longer needed once decoding finishes.
            let downloadedDirectory = url.deletingLastPathComponent()
            defer { try? FileManager.default.removeItem(at: downloadedDirectory) }
            guard
                let bitmap = await AttachmentImageDecoder.decode(
                    at: url,
                    maxPixelSize: AttachmentImageTileSize.maxDimension * 2
                )
            else {
                onFailure()
                return
            }
            let thumbnail = AttachmentThumbnail(
                image: Image(decorative: bitmap.cgImage, scale: 1, orientation: .up),
                size: AttachmentImageTileSize.fitted(
                    pixelWidth: bitmap.cgImage.width,
                    pixelHeight: bitmap.cgImage.height
                )
            )
            AttachmentImageCache.shared.store(
                thumbnail,
                for: attachment.id,
                decodedPixelCost: bitmap.pixelCost
            )
            loadedAttachmentID = attachment.id
        } catch is CancellationError {
            // The tile disappeared or the transfer was superseded; no error UI needed.
        } catch {
            onFailure()
        }
    }
}
