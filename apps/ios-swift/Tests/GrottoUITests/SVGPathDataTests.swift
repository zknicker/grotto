@testable import GrottoUI
import CoreGraphics
import SwiftUI
import XCTest

final class SVGPathDataTests: XCTestCase {
    func testParsesAbsoluteLineCommands() {
        let path = SVGPathData.path(from: "M2 4 L20 4 L20 18 Z")

        assertBounds(path, CGRect(x: 2, y: 4, width: 18, height: 14))
        XCTAssertEqual(path.currentPoint, CGPoint(x: 2, y: 4))
    }

    func testParsesRelativeCommandsAgainstTheCurrentPoint() {
        let absolute = SVGPathData.path(from: "M2 4 L20 4 L20 18 Z")
        let relative = SVGPathData.path(from: "m2 4 l18 0 l0 14 z")

        assertBounds(relative, CGRect(x: 2, y: 4, width: 18, height: 14))
        XCTAssertEqual(relative.description, absolute.description)
    }

    func testRepeatsTheLastCommandForExtraCoordinatePairs() {
        // A moveto followed by extra pairs is an implicit lineto, and numbers
        // need no separator when the sign or decimal point already ends one.
        let path = SVGPathData.path(from: "M1 1 5 1 5 9-3 9Z")

        assertBounds(path, CGRect(x: -3, y: 1, width: 8, height: 8))
    }

    func testParsesHorizontalAndVerticalCommands() {
        let path = SVGPathData.path(from: "M4 4H20V16h-6v4")

        assertBounds(path, CGRect(x: 4, y: 4, width: 16, height: 16))
        XCTAssertEqual(path.currentPoint, CGPoint(x: 14, y: 20))
    }

    func testParsesCubicAndSmoothCubicCurves() {
        let path = SVGPathData.path(from: "M0 12 C0 6 6 0 12 0 S24 6 24 12")

        assertBounds(path, CGRect(x: 0, y: 0, width: 24, height: 12))
        XCTAssertEqual(path.currentPoint, CGPoint(x: 24, y: 12))
    }

    func testParsesQuadraticAndSmoothQuadraticCurves() {
        let path = SVGPathData.path(from: "M0 12 Q6 0 12 12 T24 12")

        XCTAssertEqual(path.currentPoint, CGPoint(x: 24, y: 12))
        // The smooth segment reflects the first control point, so the curve
        // mirrors below the baseline instead of repeating the arch above it.
        let bounds = path.boundingRect
        XCTAssertEqual(bounds.minY, 6, accuracy: 0.001)
        XCTAssertEqual(bounds.maxY, 18, accuracy: 0.001)
    }

    func testParsesArcsAsACompleteCircle() {
        // The two-half-arc form the icon generator emits for `circle` elements.
        let path = SVGPathData.path(from: "M5 12A7 7 0 1 0 19 12A7 7 0 1 0 5 12Z")

        assertBounds(path, CGRect(x: 5, y: 5, width: 14, height: 14), accuracy: 0.01)
    }

    func testArcSweepFlagChoosesTheOppositeBulge() {
        let sweep = SVGPathData.path(from: "M4 12 A8 8 0 0 1 20 12")
        let counter = SVGPathData.path(from: "M4 12 A8 8 0 0 0 20 12")

        // SVG sweeps in the direction of increasing angle, and y grows
        // downward, so sweep=1 arcs over the top.
        assertBounds(sweep, CGRect(x: 4, y: 4, width: 16, height: 8), accuracy: 0.01)
        assertBounds(counter, CGRect(x: 4, y: 12, width: 16, height: 8), accuracy: 0.01)
    }

    func testParsesRelativeArcsAndUnseparatedFlags() {
        let absolute = SVGPathData.path(from: "M4 12 A8 8 0 0 1 20 12")
        let relative = SVGPathData.path(from: "M4 12a8 8 0 0116 0")

        assertBounds(relative, CGRect(x: 4, y: 4, width: 16, height: 8), accuracy: 0.01)
        XCTAssertEqual(relative.description, absolute.description)
    }

    func testArcWithTooSmallRadiiStillReachesItsEndpoint() {
        let path = SVGPathData.path(from: "M2 12 A1 1 0 0 1 22 12")

        XCTAssertEqual(path.currentPoint?.x ?? 0, 22, accuracy: 0.01)
        XCTAssertEqual(path.currentPoint?.y ?? 0, 12, accuracy: 0.01)
    }

    func testCloseSubpathReturnsToTheSubpathStart() {
        let path = SVGPathData.path(from: "M4 4 H12 V12 Z L20 20")

        XCTAssertEqual(path.currentPoint, CGPoint(x: 20, y: 20))
        assertBounds(path, CGRect(x: 4, y: 4, width: 16, height: 16))
    }

    func testUnparseableInputKeepsWhateverWasReadInsteadOfCrashing() {
        XCTAssertTrue(SVGPathData.path(from: "").isEmpty)
        XCTAssertTrue(SVGPathData.path(from: "not path data").isEmpty)
        assertBounds(
            SVGPathData.path(from: "M2 2 L10 10 L?? 4"),
            CGRect(x: 2, y: 2, width: 8, height: 8)
        )
    }

    func testBareNumbersAfterACloseDoNotSpin() {
        // Close consumes no coordinates, so treating it as a repeatable command
        // would loop forever on malformed data.
        assertBounds(
            SVGPathData.path(from: "M2 2 L10 10 Z 4 4 6 6"),
            CGRect(x: 2, y: 2, width: 8, height: 8)
        )
    }

    func testParsesExponentAndLeadingDecimalNumbers() {
        let path = SVGPathData.path(from: "M.5.5L1e1 .5L1e1 1e1")

        assertBounds(path, CGRect(x: 0.5, y: 0.5, width: 9.5, height: 9.5))
    }

    private func assertBounds(
        _ path: Path,
        _ expected: CGRect,
        accuracy: CGFloat = 0.001,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let bounds = path.boundingRect
        XCTAssertEqual(bounds.minX, expected.minX, accuracy: accuracy, "minX", file: file, line: line)
        XCTAssertEqual(bounds.minY, expected.minY, accuracy: accuracy, "minY", file: file, line: line)
        XCTAssertEqual(bounds.width, expected.width, accuracy: accuracy, "width", file: file, line: line)
        XCTAssertEqual(bounds.height, expected.height, accuracy: accuracy, "height", file: file, line: line)
    }
}
