import Foundation
import ImageIO

#if canImport(UIKit)
import UIKit
typealias AvatarPlatformImage = UIImage
#elseif canImport(AppKit)
import AppKit
typealias AvatarPlatformImage = NSImage
#endif

/// Process-wide decoded avatar cache.
///
/// Avatar URLs are immutable Server resources. Keeping their decoded images
/// here lets a newly constructed chat render a previously seen identity in
/// its first frame instead of briefly falling back to initials. In-flight
/// requests are shared so repeated rows do not download the same avatar.
@MainActor
final class AvatarImageCache {
    static let shared = AvatarImageCache()

    private let images = NSCache<NSURL, PlatformImageBox>()
    private var loads: [URL: Task<Data?, Never>] = [:]

    init() {
        images.countLimit = 100
        images.totalCostLimit = 32 * 1024 * 1024
    }

    func image(for url: URL) -> AvatarPlatformImage? {
        images.object(forKey: url as NSURL)?.image
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
        images.setObject(
            PlatformImageBox(image: decoded.image),
            forKey: url as NSURL,
            cost: decoded.pixelCost
        )
        return decoded.image
    }

    private static func fetch(_ url: URL) async -> Data? {
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
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
