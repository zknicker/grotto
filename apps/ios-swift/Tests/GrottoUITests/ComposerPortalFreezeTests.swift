@testable import GrottoUI
import XCTest

@MainActor
final class ComposerPortalFreezeTests: XCTestCase {
    private let keyboardInset: CGFloat = 336
    private let homeIndicatorInset: CGFloat = 34

    func testIdleFreezePassesTheLiveInsetThrough() {
        let freeze = ComposerPortalFreeze()

        XCTAssertFalse(freeze.isEngaged)
        XCTAssertEqual(freeze.bottomInset(live: keyboardInset), keyboardInset)
        XCTAssertEqual(freeze.bottomInset(live: homeIndicatorInset), homeIndicatorInset)
    }

    func testFocusedEntryHoldsTheKeyboardInsetAfterTheKeyboardLeaves() {
        var freeze = ComposerPortalFreeze()
        freeze.engage(bottomInset: keyboardInset, isTextFocused: true)

        XCTAssertTrue(freeze.isEngaged)
        XCTAssertTrue(freeze.restoresTextFocus)
        // The keyboard has gone; the chat still lays out against its height.
        XCTAssertEqual(freeze.bottomInset(live: homeIndicatorInset), keyboardInset)
    }

    func testEngagingTwiceKeepsTheFirstCapture() {
        var freeze = ComposerPortalFreeze()
        freeze.engage(bottomInset: keyboardInset, isTextFocused: true)
        freeze.engage(bottomInset: homeIndicatorInset, isTextFocused: false)

        XCTAssertEqual(freeze.frozenBottomInset, keyboardInset)
        XCTAssertTrue(freeze.restoresTextFocus)
    }

    func testCommitFromAFocusedComposerWaitsForTheKeyboardToComeBack() {
        var freeze = ComposerPortalFreeze()
        freeze.engage(bottomInset: keyboardInset, isTextFocused: true)

        let plan = freeze.closePlan(live: homeIndicatorInset)

        XCTAssertTrue(plan.restoresTextFocus)
        XCTAssertTrue(plan.waitsForKeyboard)
    }

    func testCommitReleasesOnceTheKeyboardHasFinishedReturning() {
        var freeze = ComposerPortalFreeze()
        freeze.engage(bottomInset: keyboardInset, isTextFocused: true)

        XCTAssertFalse(freeze.matchesFrozenInset(homeIndicatorInset))
        XCTAssertFalse(freeze.matchesFrozenInset(keyboardInset - 40))
        XCTAssertTrue(freeze.matchesFrozenInset(keyboardInset))

        let plan = freeze.closePlan(live: keyboardInset)
        XCTAssertTrue(plan.restoresTextFocus)
        XCTAssertFalse(plan.waitsForKeyboard)
    }

    func testUnfocusedEntryNeverSummonsAKeyboardAndReleasesImmediately() {
        var freeze = ComposerPortalFreeze()
        freeze.engage(bottomInset: homeIndicatorInset, isTextFocused: false)

        let plan = freeze.closePlan(live: homeIndicatorInset)

        XCTAssertFalse(plan.restoresTextFocus)
        XCTAssertFalse(plan.waitsForKeyboard)
        XCTAssertEqual(freeze.bottomInset(live: homeIndicatorInset), homeIndicatorInset)
    }

    func testCancellingThePortalRestoresTheSameFocusAsCommitting() {
        var focused = ComposerPortalFreeze()
        focused.engage(bottomInset: keyboardInset, isTextFocused: true)
        var unfocused = ComposerPortalFreeze()
        unfocused.engage(bottomInset: homeIndicatorInset, isTextFocused: false)

        XCTAssertEqual(
            focused.closePlan(live: keyboardInset),
            ComposerPortalClosePlan(restoresTextFocus: true, waitsForKeyboard: false)
        )
        XCTAssertEqual(
            unfocused.closePlan(live: homeIndicatorInset),
            ComposerPortalClosePlan(restoresTextFocus: false, waitsForKeyboard: false)
        )
    }

    func testReleaseHandsTheLiveInsetBack() {
        var freeze = ComposerPortalFreeze()
        freeze.engage(bottomInset: keyboardInset, isTextFocused: true)
        freeze.release()

        XCTAssertFalse(freeze.isEngaged)
        XCTAssertFalse(freeze.restoresTextFocus)
        XCTAssertEqual(freeze.bottomInset(live: homeIndicatorInset), homeIndicatorInset)
    }

    func testClosingWithoutAFreezeDoesNothing() {
        let freeze = ComposerPortalFreeze()

        XCTAssertEqual(
            freeze.closePlan(live: keyboardInset),
            ComposerPortalClosePlan(restoresTextFocus: false, waitsForKeyboard: false)
        )
    }
}
