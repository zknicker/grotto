@testable import GrottoUI
import XCTest

/// The generator refuses to emit a resource missing a name `GrottoIconName`
/// asks for, but nothing catches a resource that went stale in the repo — a
/// case added without regenerating draws an empty box rather than failing.
/// This is the check that turns that into a test failure.
@MainActor
final class AppIconCatalogTests: XCTestCase {
    func testEveryNamedIconCarriesGeometry() {
        for name in GrottoIconName.allCases {
            let subpaths = UIIconCatalog.shared.subpaths(for: name, weight: 1.5)
            XCTAssertFalse(
                subpaths.isEmpty,
                "\(name.rawValue) has no geometry; regenerate ui-icons.json"
            )
        }
    }

    func testNamesAreDistinctSoTwoConceptsCannotDriftOntoOneGlyph() {
        let names = GrottoIconName.allCases.map(\.rawValue)
        XCTAssertEqual(Set(names).count, names.count)
    }

    /// The weight a caller passes has to reach the stroke, because it is the
    /// one knob that keeps a 1.5-stroke family from reading thin beside text.
    func testWeightScalesTheStroke() {
        let light = UIIconCatalog.shared.subpaths(for: .tasks, weight: 1.5)
        let heavy = UIIconCatalog.shared.subpaths(for: .tasks, weight: 3)
        XCTAssertEqual(light.count, heavy.count)
        let lightStroke = light.compactMap(\.stroke?.width).first
        let heavyStroke = heavy.compactMap(\.stroke?.width).first
        XCTAssertNotNil(lightStroke)
        XCTAssertEqual(try XCTUnwrap(heavyStroke), try XCTUnwrap(lightStroke) * 2, accuracy: 0.0001)
    }

    /// Every element in the stroke-rounded family is stroked chrome — nothing
    /// the app icon set draws carries a `fill`. So a subpath that arrives
    /// without a stroke width is a conversion bug, and it fails silently: the
    /// renderer reads "no stroke" as filled geometry and paints a solid blob,
    /// turning a head into a disc and a globe's meridians into a ball.
    func testNoNamedIconDrawsAsFilledGeometry() {
        for name in GrottoIconName.allCases {
            for (index, subpath) in UIIconCatalog.shared
                .subpaths(for: name, weight: 1.5).enumerated() {
                XCTAssertNotNil(
                    subpath.stroke,
                    "\(name.rawValue) subpath \(index) has no stroke and will fill solid"
                )
            }
        }
    }

    /// The same contract one level down, over the whole generated resource
    /// rather than the names the phone happens to draw today — so a name a
    /// later call site picks up cannot already be broken in the file.
    func testTheGeneratedResourceNeverDropsAStrokeWidth() throws {
        let icons = try Self.resourceIcons()
        XCTAssertGreaterThan(icons.count, 100)
        for name in ["UserIcon", "Globe02Icon", "GitPullRequestIcon", "Clock01Icon"] {
            XCTAssertNotNil(icons[name], "\(name) is missing from ui-icons.json")
        }
        for (name, subpaths) in icons {
            XCTAssertFalse(subpaths.isEmpty, "\(name) has no subpaths")
            for (index, subpath) in subpaths.enumerated() {
                XCTAssertNotNil(
                    subpath.strokeWidth,
                    "\(name) subpath \(index) lost its stroke width; regenerate ui-icons.json"
                )
            }
        }
    }

    private struct Resource: Decodable {
        let icons: [String: [HugeiconResourceSubpath]]
    }

    private static func resourceIcons() throws -> [String: [HugeiconResourceSubpath]] {
        let url = try XCTUnwrap(
            Bundle.module.url(forResource: "ui-icons", withExtension: "json")
        )
        return try JSONDecoder().decode(Resource.self, from: Data(contentsOf: url)).icons
    }
}
