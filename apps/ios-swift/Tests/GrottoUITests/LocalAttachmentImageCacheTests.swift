import Foundation
@testable import GrottoUI
import Testing

@MainActor
struct LocalAttachmentImageCacheTests {
    @Test func decodesAStagedImageAndKeepsItForSynchronousReuse() async throws {
        let cache = LocalAttachmentImageCache()
        let url = try Self.writeOnePixelPNG()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }

        let loaded = await cache.load(url: url)

        #expect(loaded != nil)
        #expect(loaded?.pixelWidth == 1)
        #expect(loaded?.pixelHeight == 1)
        // A cache hit must resolve synchronously so the first frame renders
        // the image with no async hop.
        #expect(cache.entry(for: url) != nil)
    }

    @Test func returnsNilForAMissingFile() async {
        let cache = LocalAttachmentImageCache()
        let missing = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathComponent("gone.jpg")

        let loaded = await cache.load(url: missing)

        #expect(loaded == nil)
        #expect(cache.entry(for: missing) == nil)
    }

    private static func writeOnePixelPNG() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appendingPathComponent("pixel.png")
        let data = try #require(Data(base64Encoded: Self.onePixelPNG))
        try data.write(to: url)
        return url
    }

    private static let onePixelPNG =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
}
