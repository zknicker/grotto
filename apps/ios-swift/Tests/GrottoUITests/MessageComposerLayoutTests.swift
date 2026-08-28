@testable import GrottoUI
import XCTest

@MainActor
final class MessageComposerLayoutTests: XCTestCase {
    func testRestingComposerIsCompact() {
        XCTAssertFalse(
            MessageComposerView.shouldExpand(
                isFocused: false,
                hasAttachments: false,
                isPreparingAttachment: false,
                isPortalActive: false
            )
        )
    }

    func testFocusExpandsComposer() {
        XCTAssertTrue(
            MessageComposerView.shouldExpand(
                isFocused: true,
                hasAttachments: false,
                isPreparingAttachment: false,
                isPortalActive: false
            )
        )
    }

    func testAttachmentWorkKeepsComposerExpanded() {
        XCTAssertTrue(
            MessageComposerView.shouldExpand(
                isFocused: false,
                hasAttachments: true,
                isPreparingAttachment: false,
                isPortalActive: false
            )
        )
        XCTAssertTrue(
            MessageComposerView.shouldExpand(
                isFocused: false,
                hasAttachments: false,
                isPreparingAttachment: true,
                isPortalActive: false
            )
        )
    }

    func testOpenPortalKeepsTheBlurredComposerExpanded() {
        XCTAssertTrue(
            MessageComposerView.shouldExpand(
                isFocused: false,
                hasAttachments: false,
                isPreparingAttachment: false,
                isPortalActive: true
            )
        )
    }

    func testControlsRowHugsTheBottomEdgeAtEveryExpansion() {
        for totalHeight in [CGFloat(48), 61, 74] {
            XCTAssertEqual(
                ComposerControlLayout.controlsRowMinY(totalHeight: totalHeight, controlsHeight: 34),
                totalHeight - 34
            )
        }
    }

    func testFieldWidensLateInTheExpansion() {
        XCTAssertLessThan(ComposerControlLayout.fieldProgress(for: 0.5), 0.1)
        XCTAssertEqual(ComposerControlLayout.fieldProgress(for: 1), 1)
    }

    func testSingleLineTextZoneStaysCloseToTheControlsRow() {
        let singleLine = ComposerControlLayout.expandedTopHeight(forFieldHeight: 22)

        XCTAssertEqual(singleLine, ComposerControlLayout.expandedFieldMinimumHeight)
        XCTAssertLessThanOrEqual(singleLine - 22, 6)
    }

    func testTallDraftGrowsTheTextZone() {
        XCTAssertEqual(ComposerControlLayout.expandedTopHeight(forFieldHeight: 96), 96)
    }

    func testExpandedTextIsInsetEquallyFromBothShellEdges() {
        let width: CGFloat = 300
        let fieldWidth = ComposerControlLayout.expandedFieldWidth(inWidth: width)
        let leadingInset = ComposerControlLayout.expandedFieldInset

        XCTAssertEqual(leadingInset, 10)
        XCTAssertEqual(width - (leadingInset + fieldWidth), leadingInset)
    }

    func testCollapsedPlaceholderClearsThePlusButton() {
        let width: CGFloat = 300
        let attachmentWidth: CGFloat = 32
        let sendWidth: CGFloat = 34
        let fieldWidth = ComposerControlLayout.compactFieldWidth(
            inWidth: width,
            attachmentWidth: attachmentWidth,
            sendWidth: sendWidth
        )
        let fieldOrigin = attachmentWidth + ComposerControlLayout.compactFieldGap

        XCTAssertEqual(ComposerControlLayout.compactFieldGap, 12)
        XCTAssertEqual(
            width - sendWidth - (fieldOrigin + fieldWidth),
            ComposerControlLayout.compactSendGap
        )
    }

    func testSourceMenuSitsOnTheComposerTopEdge() {
        let padding = ComposerPortalGeometry.sourceMenuBottomPadding(
            composerTop: 440,
            containerHeight: 540,
            menuHeight: 210
        )

        XCTAssertEqual(padding, 108)
    }

    func testSourceMenuNeverLeavesTheTopOfTheScreen() {
        let padding = ComposerPortalGeometry.sourceMenuBottomPadding(
            composerTop: 180,
            containerHeight: 540,
            menuHeight: 210
        )

        XCTAssertEqual(padding, 322)
        XCTAssertGreaterThanOrEqual(540 - padding - 210, 8)
    }

    func testLandingPhotoRevealsBeforeTheMorphEnds() {
        XCTAssertEqual(MorphingAttachmentImage.revealProgress(for: 0.3), 0)
        XCTAssertGreaterThan(MorphingAttachmentImage.revealProgress(for: 0.5), 0.3)
        XCTAssertEqual(MorphingAttachmentImage.revealProgress(for: 0.8), 1)
    }
}
