import Foundation
import ImageIO

#if canImport(UIKit)
import UIKit
typealias AvatarPlatformImage = UIImage
#elseif canImport(AppKit)
import AppKit
typealias AvatarPlatformImage = NSImage
#endif

/// Process-wide decoded avatar cache over a disk-persisted byte cache.
///
/// Avatar URLs are immutable Server resources. Keeping their decoded images
/// here lets a newly constructed chat render a previously seen identity in
/// its first frame instead of briefly falling back to initials. In-flight
/// requests are shared so repeated rows do not download the same avatar. The
/// bytes behind those images survive the process in `Self.session`'s own
/// `URLCache`, so a cold launch paints known identities instead of showing
/// initials until the network answers.
@MainActor
final class AvatarImageCache {
    static let shared = AvatarImageCache()

    private let images = NSCache<NSURL, PlatformImageBox>()
    private var loads: [URL: Task<Data?, Never>] = [:]
    /// Every avatar this process has decoded at least once. `images` is an
    /// `NSCache` and drops entries under pressure; without this set a recycled
    /// row would read "no avatar", raster initials over an avatar it had
    /// already drawn, and reload — a visible flip and two junk chip bitmaps.
    private var resolvedURLs: Set<URL> = []

    init() {
        images.countLimit = 100
        images.totalCostLimit = 32 * 1024 * 1024
    }

    /// The avatar's decoded pixels, ready for a synchronous render. An entry
    /// the memory cache has evicted is restored from the disk byte cache; when
    /// even those bytes are gone the URL stops claiming to be resolved, so the
    /// caller falls back to initials rather than rendering blank.
    func image(for url: URL) -> AvatarPlatformImage? {
        if let cached = images.object(forKey: url as NSURL)?.image {
            return cached
        }
        guard resolvedURLs.contains(url) else { return nil }
        guard let data = Self.byteCache.cachedResponse(for: URLRequest(url: url))?.data,
              let decoded = Self.decode(data)
        else {
            resolvedURLs.remove(url)
            return nil
        }
        store(decoded, for: url)
        return decoded.image
    }

    func load(
        url: URL,
        fetch: ((URL) async -> Data?)? = nil
    ) async -> AvatarPlatformImage? {
        if let cached = image(for: url) {
            return cached
        }

        let task: Task<Data?, Never>
        if let active = loads[url] {
            task = active
        } else {
            let request = fetch ?? Self.fetch
            task = Task { await request(url) }
            loads[url] = task
        }

        guard let data = await task.value else {
            loads[url] = nil
            return nil
        }
        loads[url] = nil

        guard let decoded = Self.decode(data) else { return nil }
        store(decoded, for: url)
        return decoded.image
    }

    private func store(_ decoded: (image: AvatarPlatformImage, pixelCost: Int), for url: URL) {
        images.setObject(
            PlatformImageBox(image: decoded.image),
            forKey: url as NSURL,
            cost: decoded.pixelCost
        )
        resolvedURLs.insert(url)
    }

    /// Avatars get their own byte cache because `URLSession.shared` caches for
    /// ordinary API traffic and evicts image bytes long before the next launch
    /// needs them. It also outlives the decoded `NSCache`, which is what lets
    /// an evicted avatar come back without a round trip.
    private static let byteCache = URLCache(
        memoryCapacity: 4 * 1024 * 1024,
        diskCapacity: 64 * 1024 * 1024,
        directory: FileManager.default
            .urls(for: .cachesDirectory, in: .userDomainMask)
            .first?
            .appendingPathComponent("grotto-avatars", isDirectory: true)
    )

    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.urlCache = byteCache
        return URLSession(configuration: configuration)
    }()

    private static func fetch(_ url: URL) async -> Data? {
        do {
            // An avatar URL names immutable bytes, which is the license to
            // answer from disk without revalidating: whatever the Server said
            // about freshness cannot make a stored avatar wrong.
            let request = URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad)
            let (data, response) = try await session.data(for: request)
            guard let response = response as? HTTPURLResponse,
                  (200..<300).contains(response.statusCode)
            else { return nil }
            return data
        } catch {
            return nil
        }
    }

    private static func decode(_ data: Data) -> (image: AvatarPlatformImage, pixelCost: Int)? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let cgImage = CGImageSourceCreateImageAtIndex(
                  source,
                  0,
                  [kCGImageSourceShouldCacheImmediately: true] as CFDictionary
              )
        else { return nil }

        #if canImport(UIKit)
        let image = UIImage(cgImage: cgImage)
        #elseif canImport(AppKit)
        let image = NSImage(cgImage: cgImage, size: .zero)
        #endif
        return (image, cgImage.width * cgImage.height * 4)
    }

    private final class PlatformImageBox {
        let image: AvatarPlatformImage
        init(image: AvatarPlatformImage) { self.image = image }
    }
}
