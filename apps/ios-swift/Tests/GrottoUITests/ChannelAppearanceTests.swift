@testable import GrottoUI
import CoreGraphics
import XCTest

final class ChannelColorPaletteTests: XCTestCase {
    func testCarriesTheEighteenAppPresetsWithUniqueIDs() {
        XCTAssertEqual(ChannelColorPalette.presets.count, 18)
        XCTAssertEqual(Set(ChannelColorPalette.presets.map(\.id)).count, 18)
    }

    func testResolvesAStoredPresetIDLeniently() {
        XCTAssertEqual(ChannelColorPalette.preset(for: "amber")?.id, "amber")
        XCTAssertEqual(ChannelColorPalette.preset(for: " Violet ")?.id, "violet")
    }

    func testUnsetAndUnknownColorsFallBackToTheMutedDefault() {
        XCTAssertNil(ChannelColorPalette.preset(for: nil))
        XCTAssertNil(ChannelColorPalette.preset(for: ""))
        // The App stores preset ids, never hex, so a raw value is not a tint.
        XCTAssertNil(ChannelColorPalette.preset(for: "#ff0000"))
    }

    func testTintAndBoxFillDifferBySchemeSoTheBoxStaysAWash() {
        let amber = try? XCTUnwrap(ChannelColorPalette.preset(for: "amber"))
        XCTAssertNotEqual(amber?.tint(.light), amber?.tint(.dark))
        XCTAssertNotEqual(amber?.tint(.light), amber?.boxFill(.light))
    }
}

@MainActor
final class ChannelIconCatalogTests: XCTestCase {
    func testResolvesABundledGlyphIntoTheUnitSquare() async throws {
        let catalog = try await loadedCatalog()
        let subpaths = try XCTUnwrap(catalog.subpaths(for: "RocketIcon"))

        XCTAssertFalse(subpaths.isEmpty)
        for subpath in subpaths {
            let bounds = subpath.path.boundingRect
            XCTAssertGreaterThanOrEqual(bounds.minX, -0.001)
            XCTAssertGreaterThanOrEqual(bounds.minY, -0.001)
            XCTAssertLessThanOrEqual(bounds.maxX, 1.001)
            XCTAssertLessThanOrEqual(bounds.maxY, 1.001)
        }
    }

    func testCarriesTheStrokedAndCircleGeometryTheGeneratorConverts() async throws {
        let catalog = try await loadedCatalog()

        let stroked = try XCTUnwrap(catalog.subpaths(for: "IrisScanIcon"))
        XCTAssertTrue(stroked.contains { $0.stroke != nil })

        // `circle` elements become arcs, so this only resolves if the arc
        // parser round-trips them.
        let converted = try XCTUnwrap(catalog.subpaths(for: "TruckIcon"))
        XCTAssertGreaterThanOrEqual(converted.count, 3)
    }

    func testUnknownAndUnsetNamesLeaveTheHashFallbackInPlace() async throws {
        let catalog = try await loadedCatalog()

        XCTAssertNil(catalog.subpaths(for: nil))
        XCTAssertNil(catalog.subpaths(for: ""))
        XCTAssertNil(catalog.subpaths(for: "NotAnIcon"))
    }

    func testGlyphsAreParsedOnceAndCached() async throws {
        let catalog = try await loadedCatalog()
        let first = try XCTUnwrap(catalog.subpaths(for: "CompassIcon"))
        let second = try XCTUnwrap(catalog.subpaths(for: "CompassIcon"))

        XCTAssertEqual(first.count, second.count)
        XCTAssertEqual(first.first?.path.description, second.first?.path.description)
    }

    /// The load is a detached task, so the test waits for the first name to
    /// resolve rather than assuming a fixed delay.
    private func loadedCatalog() async throws -> ChannelIconCatalog {
        let catalog = ChannelIconCatalog()
        catalog.load()

        for _ in 0..<200 {
            if catalog.subpaths(for: "RocketIcon") != nil { return catalog }
            try await Task.sleep(nanoseconds: 25_000_000)
        }

        XCTFail("The bundled channel icon catalog never finished loading.")
        return catalog
    }
}
