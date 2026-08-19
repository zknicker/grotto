@testable import GrottoUI
import CoreGraphics
import XCTest

final class DrawerInteractionTests: XCTestCase {
    private let width: CGFloat = 320

    func testCanvasFollowsTheFingerInsideItsTravel() {
        XCTAssertEqual(
            DrawerInteraction.offset(isOpen: false, translation: 90, width: width),
            90,
            accuracy: 0.001
        )
        XCTAssertEqual(
            DrawerInteraction.offset(isOpen: true, translation: -120, width: width),
            200,
            accuracy: 0.001
        )
    }

    func testDragStopsAtBothEnds() {
        XCTAssertEqual(
            DrawerInteraction.offset(isOpen: true, translation: 160, width: width),
            width,
            accuracy: 0.001
        )
        XCTAssertEqual(
            DrawerInteraction.offset(isOpen: false, translation: -160, width: width),
            0,
            accuracy: 0.001
        )
    }

    func testShortFlickOpensTheDrawer() {
        XCTAssertTrue(DrawerInteraction.settlesOpen(offset: 40, velocity: 1200, width: width))
    }

    func testSlowDragPastTheMidpointOpensTheDrawer() {
        XCTAssertTrue(DrawerInteraction.settlesOpen(offset: 200, velocity: 30, width: width))
        XCTAssertFalse(DrawerInteraction.settlesOpen(offset: 140, velocity: 30, width: width))
    }

    func testReverseFlickClosesAnAlmostOpenDrawer() {
        XCTAssertFalse(DrawerInteraction.settlesOpen(offset: 300, velocity: -900, width: width))
    }

    func testSettleVelocityIsNormalizedToTheRemainingDistance() {
        let velocity = DrawerInteraction.settleVelocity(velocity: 600, offset: 220, target: width)
        XCTAssertEqual(velocity, 6, accuracy: 0.001)

        XCTAssertEqual(
            DrawerInteraction.settleVelocity(velocity: 600, offset: width, target: width),
            0,
            accuracy: 0.001
        )
        XCTAssertLessThanOrEqual(
            DrawerInteraction.settleVelocity(velocity: 4000, offset: 319, target: width),
            25
        )
    }

    func testOnlyHorizontalDragsMoveTheDrawer() {
        XCTAssertTrue(DrawerInteraction.accepts(velocity: CGPoint(x: 300, y: 40), isOpen: false))
        XCTAssertFalse(DrawerInteraction.accepts(velocity: CGPoint(x: 60, y: 400), isOpen: false))
    }

    func testAClosedDrawerOnlyAcceptsRightwardDrags() {
        XCTAssertFalse(DrawerInteraction.accepts(velocity: CGPoint(x: -300, y: 20), isOpen: false))
        XCTAssertTrue(DrawerInteraction.accepts(velocity: CGPoint(x: -300, y: 20), isOpen: true))
    }
}
