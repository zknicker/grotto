import Foundation
@testable import GrottoUI
import SwiftUI
import Testing

@MainActor
struct AttachmentImageCacheTests {
    @Test func storesAndReturnsAThumbnailByAttachmentID() {
        let cache = AttachmentImageCache()
        let thumbnail = AttachmentThumbnail(image: Image(systemName: "photo"), size: .init(width: 240, height: 180))

        cache.store(thumbnail, for: "attachment-1", decodedPixelCost: 4)

        #expect(cache.thumbnail(for: "attachment-1") != nil)
        #expect(cache.thumbnail(for: "attachment-2") == nil)
    }

    /// The pending → sent bridge: a bitmap decoded for a staged local file is
    /// adoptable under the fresh Server attachment id via filename + size.
    @Test func adoptsAStagedThumbnailUnderTheServerAttachmentID() {
        let cache = AttachmentImageCache()
        let thumbnail = AttachmentThumbnail(image: Image(systemName: "photo"), size: .init(width: 180, height: 180))
        cache.store(
            thumbnail,
            for: "pending-attachment",
            decodedPixelCost: 4,
            stagedContentKey: AttachmentImageCache.stagedContentKey(filename: "Photo.jpg", sizeBytes: 1234)
        )

        let adopted = cache.adoptStagedThumbnail(filename: "Photo.jpg", sizeBytes: 1234, as: "server-attachment")

        #expect(adopted != nil)
        #expect(cache.thumbnail(for: "server-attachment") != nil)
    }

    @Test func refusesToAdoptWhenFilenameOrSizeDiffers() {
        let cache = AttachmentImageCache()
        let thumbnail = AttachmentThumbnail(image: Image(systemName: "photo"), size: .init(width: 180, height: 180))
        cache.store(
            thumbnail,
            for: "pending-attachment",
            decodedPixelCost: 4,
            stagedContentKey: AttachmentImageCache.stagedContentKey(filename: "Photo.jpg", sizeBytes: 1234)
        )

        #expect(cache.adoptStagedThumbnail(filename: "Photo.jpg", sizeBytes: 999, as: "a") == nil)
        #expect(cache.adoptStagedThumbnail(filename: "Other.jpg", sizeBytes: 1234, as: "b") == nil)
    }
}
