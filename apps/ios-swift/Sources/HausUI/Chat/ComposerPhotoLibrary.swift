import CoreGraphics
#if os(iOS)
@preconcurrency import Photos
import UIKit
#endif

/// The photo grid's cell geometry, computed once from the portal card's known width instead of
/// once per cell from a `GeometryReader` — so a thumbnail request can start before the grid has
/// even measured itself. `PHImageManager` targetSize wants device pixels, so this is the point
/// size scaled by the caller's display scale.
enum ComposerPhotoGridLayout {
    static let columnCount = 3
    static let interItemSpacing: CGFloat = 2

    /// The square cell's edge in points. The grid must frame each cell to exactly this — a
    /// `scaledToFill` thumbnail otherwise reports its photo's native size as the cell's ideal
    /// height, and the grid explodes to full-resolution cells.
    static func cellPointSize(cardWidth: CGFloat) -> CGFloat {
        guard cardWidth > 0 else { return 0 }
        let spacing = interItemSpacing * CGFloat(columnCount - 1)
        return max(0, (cardWidth - spacing) / CGFloat(columnCount))
    }

    static func cellSize(cardWidth: CGFloat, displayScale: CGFloat) -> CGSize {
        guard displayScale > 0 else { return .zero }
        let pixels = (cellPointSize(cardWidth: cardWidth) * displayScale).rounded(.up)
        return CGSize(width: pixels, height: pixels)
    }
}

/// The one thing the warm path needs from Photos authorization: whether the library is already
/// readable. Kept as a domain type rather than `PHAuthorizationStatus` so the gate is testable
/// without the Photos framework — warming must never itself call `requestAuthorization` or
/// otherwise surface the system permission dialog, so this only ever answers a status already on
/// hand.
enum ComposerPhotoAccess {
    case readable
    case notReadable

    var permitsBackgroundFetch: Bool { self == .readable }
}

#if os(iOS)
extension ComposerPhotoAccess {
    init(_ status: PHAuthorizationStatus) {
        switch status {
        case .authorized, .limited: self = .readable
        default: self = .notReadable
        }
    }
}

/// Owns the composer's recent-photos session: the fetched assets, a dedicated caching image
/// manager, and thumbnail request/dedupe. `warmIfAuthorized` primes this the moment the source
/// menu opens, well before the user can tap Photos; `loadForPicker` is the picker's own
/// mount-time path and reuses whatever warming already fetched, so the grid the user morphs into
/// is already painted instead of loading fresh.
@MainActor
final class ComposerPhotoLibrary {
    static let shared = ComposerPhotoLibrary()

    enum LoadResult {
        case assets([PHAsset])
        case denied
    }

    /// Matches ChatGPT's recent-first grid: a bounded, recent-first slice needs no pagination.
    static let fetchLimit = 400
    private static let warmThumbnailCount = 30

    private(set) var assets: [PHAsset] = []
    private let imageManager = PHCachingImageManager()
    private let thumbnailCache = NSCache<NSString, UIImage>()
    private var fetchTask: Task<[PHAsset], Never>?

    private init() {}

    /// Called from the source menu, before the user has tapped Photos. Only fetches when access
    /// is already granted so warming can never surface the system permission prompt; an
    /// undecided or denied library is left for the picker's own mount-time request.
    func warmIfAuthorized(cellSize: CGSize) async {
        guard ComposerPhotoAccess(PHPhotoLibrary.authorizationStatus(for: .readWrite)).permitsBackgroundFetch
        else { return }
        await fetchIfNeeded()
        startCaching(cellSize: cellSize)
    }

    /// Called when the picker mounts. Authorization behavior is unchanged: this still requests
    /// access if it has not been decided, then loads through the same session the warm pass fed,
    /// so an already-warmed library returns instantly.
    func loadForPicker(cellSize: CGSize) async -> LoadResult {
        let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        guard ComposerPhotoAccess(status).permitsBackgroundFetch else { return .denied }
        await fetchIfNeeded()
        startCaching(cellSize: cellSize)
        return .assets(assets)
    }

    /// A synchronously-available thumbnail for the first frame, if one is already cached.
    func cachedThumbnail(for identifier: String) -> UIImage? {
        thumbnailCache.object(forKey: identifier as NSString)
    }

    /// Requests a thumbnail under `.opportunistic` delivery: `onImage` fires once with the fast,
    /// degraded decode and again with the full-quality one, instead of the old picker's approach
    /// of discarding the degraded delivery and waiting for the second call to paint anything.
    /// Returns nil when a cached full-quality image answered the request directly, so callers
    /// know there is nothing to cancel.
    @discardableResult
    func requestThumbnail(
        for asset: PHAsset,
        targetSize: CGSize,
        onImage: @escaping @MainActor (UIImage?, _ isFinal: Bool) -> Void
    ) -> PHImageRequestID? {
        if let cached = cachedThumbnail(for: asset.localIdentifier) {
            onImage(cached, true)
            return nil
        }
        let options = PHImageRequestOptions()
        options.deliveryMode = .opportunistic
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true
        let identifier = asset.localIdentifier
        return imageManager.requestImage(
            for: asset,
            targetSize: targetSize,
            contentMode: .aspectFill,
            options: options
        ) { [weak self] image, info in
            let degraded = (info?[PHImageResultIsDegradedKey] as? Bool) == true
            Task { @MainActor in
                if !degraded, let image {
                    self?.thumbnailCache.setObject(image, forKey: identifier as NSString)
                }
                onImage(image, !degraded)
            }
        }
    }

    func cancelThumbnailRequest(_ requestID: PHImageRequestID) {
        imageManager.cancelImageRequest(requestID)
    }

    /// Always refetches — the result is bounded by `fetchLimit`, so freshness costs little and a
    /// photo taken since the last open still appears. Concurrent callers share one in-flight fetch.
    private func fetchIfNeeded() async {
        if let fetchTask {
            assets = await fetchTask.value
            return
        }
        let task = Task<[PHAsset], Never> { await Self.fetchRecentImageAssets() }
        fetchTask = task
        assets = await task.value
        fetchTask = nil
    }

    private func startCaching(cellSize: CGSize) {
        guard cellSize.width > 0, cellSize.height > 0 else { return }
        let warmSlice = Array(assets.prefix(Self.warmThumbnailCount))
        guard !warmSlice.isEmpty else { return }
        imageManager.startCachingImages(
            for: warmSlice,
            targetSize: cellSize,
            contentMode: .aspectFill,
            options: nil
        )
    }

    /// Off the main actor: fetching and enumerating the whole recent-photos result set is the
    /// expensive part on a large library, so this must not block the menu-open turn or the
    /// picker's first frame.
    private static func fetchRecentImageAssets() async -> [PHAsset] {
        let limit = fetchLimit
        return await Task.detached(priority: .userInitiated) {
            let options = PHFetchOptions()
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            options.fetchLimit = limit
            let result = PHAsset.fetchAssets(with: .image, options: options)
            var fetched: [PHAsset] = []
            fetched.reserveCapacity(result.count)
            result.enumerateObjects { asset, _, _ in fetched.append(asset) }
            return fetched
        }.value
    }
}
#endif
