@testable import GrottoUI
import XCTest

@MainActor
final class MessageComposerLayoutTests: XCTestCase {
    func testRestingComposerIsCompact() {
        XCTAssertFalse(
            MessageComposerView.shouldExpand(
                isFocused: false,
                hasAttachments: false,
                isPreparingAttachment: false
            )
        )
    }

    func testFocusExpandsComposer() {
        XCTAssertTrue(
            MessageComposerView.shouldExpand(
                isFocused: true,
                hasAttachments: false,
                isPreparingAttachment: false
            )
        )
    }

    func testAttachmentWorkKeepsComposerExpanded() {
        XCTAssertTrue(
            MessageComposerView.shouldExpand(
                isFocused: false,
                hasAttachments: true,
                isPreparingAttachment: false
            )
        )
        XCTAssertTrue(
            MessageComposerView.shouldExpand(
                isFocused: false,
                hasAttachments: false,
                isPreparingAttachment: true
            )
        )
    }

    func testControlsClearTheCompactRowBeforeTheFieldWidens() {
        let midpoint = ComposerControlLayout.stagedProgress(for: 0.5)

        XCTAssertGreaterThan(midpoint.controls, 0.8)
        XCTAssertLessThan(midpoint.field, 0.1)
    }
}
