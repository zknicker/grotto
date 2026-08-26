import Foundation
import SwiftUI

/// A staged local image decoded once, downsampled, and ready to render.
struct LocalAttachmentImageEntry {
    let image: Image
    let pixelWidth: Int
    let pixelHeight: Int
}

/// Process-wide cache of decoded staged-file images keyed by file URL.
///
/// The composer renders a staged photo from many places at once — the 88pt
/// strip tile, the picker-to-composer morph (re-evaluated every frame), and
/// the pending message tile. Decoding the full-resolution file inside `body`
/// made every keystroke and every morph frame pay a synchronous full decode.
/// One downsampled ImageIO decode per file, performed off the main actor,
/// serves them all; a cache hit renders on the first frame with no async hop.
@MainActor
final class LocalAttachmentImageCache {
    static let shared = LocalAttachmentImageCache()

    /// 88pt composer tiles at 3x need 264px and the inline pending tile tops
    /// out at the timeline tile budget (480px), so one 512px decode serves
    /// every local rendering of a staged file.
    static let maxPixelSize: CGFloat = 512

    private let cache = NSCache<NSString, EntryBox>()
    private var loads: [String: Task<Void, Never>] = [:]

    init() {
        cache.countLimit = 40
        cache.totalCostLimit = 32 * 1024 * 1024
    }

    func entry(for url: URL) -> LocalAttachmentImageEntry? {
        cache.object(forKey: url.path as NSString)?.entry
    }

    /// Fire-and-forget decode so a freshly staged photo is already renderable
    /// when its first tile appears.
    func warm(url: URL) {
        Task { _ = await self.load(url: url) }
    }

    func load(url: URL) async -> LocalAttachmentImageEntry? {
        if let hit = entry(for: url) { return hit }
        let key = url.path
        let task: Task<Void, Never>
        if let active = loads[key] {
            task = active
        } else {
            task = Task { [weak self] in
                guard
                    let bitmap = await AttachmentImageDecoder.decode(
                        at: url,
                        maxPixelSize: Self.maxPixelSize
                    )
                else { return }
                self?.store(bitmap, for: key)
            }
            loads[key] = task
        }
        await task.value
        loads[key] = nil
        return entry(for: url)
    }

    private func store(_ bitmap: DecodedAttachmentBitmap, for key: String) {
        let entry = LocalAttachmentImageEntry(
            image: Image(decorative: bitmap.cgImage, scale: 1, orientation: .up),
            pixelWidth: bitmap.cgImage.width,
            pixelHeight: bitmap.cgImage.height
        )
        cache.setObject(EntryBox(entry: entry), forKey: key as NSString, cost: bitmap.pixelCost)
    }

    private final class EntryBox {
        let entry: LocalAttachmentImageEntry
        init(entry: LocalAttachmentImageEntry) { self.entry = entry }
    }
}

/// Renders a staged local image from the process-wide decoded cache. A cache
/// hit paints fully formed on the first frame; a miss shows the caller's
/// backing surface for the single async hop the off-main decode takes.
struct LocalAttachmentImage: View {
    let url: URL

    @State private var failedURL: URL?
    /// Bumped when an async decode lands so `body` re-reads the cache.
    @State private var loadedURL: URL?

    var body: some View {
        let cached = LocalAttachmentImageCache.shared.entry(for: url)
        let needsLoad = cached == nil && failedURL != url
        Group {
            if let cached {
                cached.image
                    .resizable()
                    .scaledToFill()
            } else if failedURL == url {
                GrottoIcon(.image, size: 19, weight: 1.6)
                    .foregroundStyle(.secondary)
            } else {
                Color.clear
            }
        }
        .task(id: url) {
            guard needsLoad else { return }
            if await LocalAttachmentImageCache.shared.load(url: url) == nil {
                failedURL = url
            } else {
                loadedURL = url
            }
        }
    }
}
