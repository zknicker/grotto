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
}
