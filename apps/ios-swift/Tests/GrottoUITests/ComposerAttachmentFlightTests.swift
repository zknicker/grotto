@testable import GrottoUI
import SwiftUI
import XCTest

@MainActor
final class ComposerAttachmentFlightTests: XCTestCase {
    func testOnlyTheFirstLandingReportLaunchesTheFlight() {
        var flight = ComposerAttachmentFlight(
            generation: 1,
            attachmentID: "photo-1",
            photo: nil
        )

        XCTAssertTrue(flight.launch())
        XCTAssertTrue(flight.isLaunched)
        // The landing tile keeps reporting while the composer grows its strip around it.
        XCTAssertFalse(flight.launch())
        XCTAssertFalse(flight.launch())
    }

    func testFlightLosesItsTargetWhenTheAttachmentLeavesTheComposer() {
        let flight = ComposerAttachmentFlight(
            generation: 1,
            attachmentID: "photo-1",
            photo: nil
        )

        XCTAssertTrue(flight.targetExists(in: ["photo-0", "photo-1"]))
        // Sending or removing the tile takes the landing spot with it.
        XCTAssertFalse(flight.targetExists(in: ["photo-0"]))
        XCTAssertFalse(flight.targetExists(in: []))
    }

    func testCollapseShrinksTheMediaCardOntoTheLandingTile() {
        let box = ComposerPortalGeometry(
            overlay: .photos,
            availableSize: CGSize(width: 400, height: 900),
            composerFrame: CGRect(x: 12, y: 700, width: 376, height: 60)
        )
        let scale = box.collapseScale(landing: CGRect(x: 22, y: 600, width: 88, height: 88))

        XCTAssertEqual(box.width, 376)
        XCTAssertEqual(scale.width, 88 / 376, accuracy: 0.0001)
        XCTAssertEqual(scale.height, 88 / box.height, accuracy: 0.0001)
    }

    func testCollapseStaysNeutralUntilTheTileHasReportedItsFrame() {
        let box = ComposerPortalGeometry(
            overlay: .photos,
            availableSize: CGSize(width: 400, height: 900),
            composerFrame: CGRect(x: 12, y: 700, width: 376, height: 60)
        )

        XCTAssertEqual(box.collapseScale(landing: nil).width, 1)
        XCTAssertEqual(box.collapseScale(landing: nil).height, 1)
        XCTAssertEqual(box.collapseOffset(landing: nil), .zero)
    }

    func testCollapseOffsetCarriesTheCardCornerToTheTileCorner() {
        let box = ComposerPortalGeometry(
            overlay: .photos,
            availableSize: CGSize(width: 400, height: 900),
            composerFrame: CGRect(x: 12, y: 700, width: 376, height: 60)
        )
        let offset = box.collapseOffset(landing: CGRect(x: 22, y: 600, width: 88, height: 88))

        XCTAssertEqual(offset.width, 22 - box.origin.x)
        XCTAssertEqual(offset.height, 600 - box.origin.y)
    }

    /// The media card sits on the display floor whatever the composer is doing, and it is inset
    /// from the floor by exactly what it is inset from the sides — the nesting has to be uniform
    /// for the concentric corners to resolve to one radius.
    func testMediaCardNestsUniformlyInsideTheDisplay() {
        let box = ComposerPortalGeometry(
            overlay: .photos,
            availableSize: CGSize(width: 400, height: 900),
            composerFrame: CGRect(x: 12, y: 200, width: 376, height: 60)
        )

        XCTAssertEqual(ComposerPortalGeometry.nestingInset, 12)
        XCTAssertEqual(box.bottomPadding, 12)
        XCTAssertEqual(box.origin.y, 900 - 12 - box.height)
        XCTAssertEqual(box.origin.x, 12)
        XCTAssertEqual(400 - (box.origin.x + box.width), 12)
    }

    func testCardIsGoneBeforeTheTravelEnds() {
        XCTAssertEqual(ComposerPortalCollapseModifier.fade(for: 0), 0)
        XCTAssertEqual(ComposerPortalCollapseModifier.fade(for: 0.45), 1)
        XCTAssertEqual(ComposerPortalCollapseModifier.fade(for: 1), 1)
        XCTAssertLessThan(ComposerPortalCollapseModifier.fadeEnd, 1)
    }

    /// Nothing may be invisible mid-flight: the photo has to be reading as itself before the card
    /// it came out of has finished dissolving.
    func testPhotoIsAlreadyRevealingWhenTheCardFinishesDissolving() {
        let revealAtCardExit = MorphingAttachmentImage.revealProgress(
            for: ComposerPortalCollapseModifier.fadeEnd
        )

        XCTAssertGreaterThan(revealAtCardExit, 0)
    }
}
