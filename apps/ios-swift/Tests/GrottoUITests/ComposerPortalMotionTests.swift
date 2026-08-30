@testable import GrottoUI
import SwiftUI
import XCTest

@MainActor
final class ComposerPortalMotionTests: XCTestCase {
    func testPullTracksTheFingerAndThenResists() {
        var previous: CGFloat = 0
        for distance in stride(from: CGFloat(2), through: 400, by: 2) {
            let banded = ComposerPortalRubberBand.offset(for: distance)
            XCTAssertGreaterThan(banded, previous)
            previous = banded
        }
        // The first point of travel is nearly free; the last 200 are nearly all resistance.
        XCTAssertGreaterThan(ComposerPortalRubberBand.offset(for: 1), 0.5)
        XCTAssertLessThan(
            ComposerPortalRubberBand.offset(for: 400) - ComposerPortalRubberBand.offset(for: 200),
            1
        )
    }

    func testPullNeverPassesItsLimit() {
        for distance in [CGFloat(10), 100, 1000, 10000] {
            XCTAssertLessThan(
                ComposerPortalRubberBand.offset(for: distance),
                ComposerPortalRubberBand.limit
            )
        }
    }

    func testPullKeepsTheDirectionOfTheDrag() {
        XCTAssertEqual(
            ComposerPortalRubberBand.offset(for: -120),
            -ComposerPortalRubberBand.offset(for: 120)
        )
        XCTAssertEqual(ComposerPortalRubberBand.offset(for: 0), 0)

        let diagonal = ComposerPortalRubberBand.offset(
            for: CGSize(width: -80, height: 40)
        )

        XCTAssertLessThan(diagonal.width, 0)
        XCTAssertGreaterThan(diagonal.height, 0)
    }

    /// The card resists; it must never read as deforming.
    func testStretchStaysBelowAVisibleShapeChange() {
        for translation in [CGSize(width: 600, height: 0), CGSize(width: -300, height: 900)] {
            let stretch = ComposerPortalRubberBand.stretch(
                for: ComposerPortalRubberBand.offset(for: translation)
            )

            XCTAssertLessThan(abs(stretch.width - 1), 0.015)
            XCTAssertLessThan(abs(stretch.height - 1), 0.015)
        }
    }

    func testStretchGrowsThePulledAxisAndTakesFromTheOther() {
        let stretch = ComposerPortalRubberBand.stretch(
            for: ComposerPortalRubberBand.offset(for: CGSize(width: 500, height: 0))
        )

        XCTAssertGreaterThan(stretch.width, 1)
        XCTAssertLessThan(stretch.height, 1)
    }

    func testRestingCardHasNoStretch() {
        let stretch = ComposerPortalRubberBand.stretch(for: .zero)

        XCTAssertEqual(stretch.width, 1)
        XCTAssertEqual(stretch.height, 1)
    }
}
