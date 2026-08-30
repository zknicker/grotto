import Foundation
@testable import GrottoUI
import Testing

/// Covers the two pieces of `ComposerPhotoLibrary` that are testable without the Photos
/// framework: the grid's cell-size arithmetic, and the warm gate's authorization decision. The
/// session object itself is `#if os(iOS)`-gated and needs a live `PHPhotoLibrary`, so it is
/// exercised on-device rather than here.
struct ComposerPhotoLibraryTests {
    @Test func cellSizeSplitsTheCardWidthIntoThreeSquareColumns() {
        // 304pt card, 2pt spacing between 3 columns: (304 - 4) / 3 = 100pt per cell exactly.
        let size = ComposerPhotoGridLayout.cellSize(cardWidth: 304, displayScale: 2)

        #expect(size == CGSize(width: 200, height: 200))
    }

    @Test func cellSizeScalesToDevicePixelsNotPoints() {
        let size = ComposerPhotoGridLayout.cellSize(cardWidth: 304, displayScale: 3)

        #expect(size == CGSize(width: 300, height: 300))
    }

    @Test func cellSizeRoundsAFractionalCellUp() {
        // (305 - 4) / 3 = 100.333...pt, which must round up rather than clip a pixel off the
        // request and hand PHImageManager a target smaller than the cell it fills.
        let size = ComposerPhotoGridLayout.cellSize(cardWidth: 305, displayScale: 1)

        #expect(size == CGSize(width: 101, height: 101))
    }

    @Test func cellSizeIsZeroForANonPositiveCardWidthOrScale() {
        #expect(ComposerPhotoGridLayout.cellSize(cardWidth: 0, displayScale: 2) == .zero)
        #expect(ComposerPhotoGridLayout.cellSize(cardWidth: -10, displayScale: 2) == .zero)
        #expect(ComposerPhotoGridLayout.cellSize(cardWidth: 304, displayScale: 0) == .zero)
    }

    /// The warm path's whole job: never let an undecided or denied library through. Injecting
    /// `ComposerPhotoAccess` directly — rather than a `PHAuthorizationStatus` — is what keeps this
    /// gate testable without ever calling into the Photos framework.
    @Test func onlyReadableAccessPermitsTheBackgroundFetch() {
        #expect(ComposerPhotoAccess.readable.permitsBackgroundFetch)
        #expect(!ComposerPhotoAccess.notReadable.permitsBackgroundFetch)
    }
}
