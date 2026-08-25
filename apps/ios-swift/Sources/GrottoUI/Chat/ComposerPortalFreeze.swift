import SwiftUI

/// Latches the bottom inset the chat lays out against for as long as an attachment portal owns the
/// screen.
///
/// The portal card is painted all the way down to the true screen bottom, so the keyboard leaves
/// and returns *behind* it. Nothing around the card may move while that happens, which means the
/// inset the transcript and composer lay out against has to stop tracking the keyboard for the
/// portal's whole lifecycle — from the plus menu opening until the landed photo has settled.
struct ComposerPortalFreeze: Equatable {
    private(set) var frozenBottomInset: CGFloat?
    /// Whether the text field owned the keyboard when the portal opened. The portal never summons a
    /// keyboard that was not already up.
    private(set) var restoresTextFocus = false

    var isEngaged: Bool { frozenBottomInset != nil }

    /// The inset the chat should lay out against right now.
    func bottomInset(live: CGFloat) -> CGFloat { frozenBottomInset ?? live }

    mutating func engage(bottomInset: CGFloat, isTextFocused: Bool) {
        guard frozenBottomInset == nil else { return }
        frozenBottomInset = bottomInset
        restoresTextFocus = isTextFocused
    }

    mutating func release() {
        frozenBottomInset = nil
        restoresTextFocus = false
    }

    /// True once the live inset has caught back up with the frozen one, so releasing the freeze
    /// resolves to the exact same layout and the swap is invisible.
    func matchesFrozenInset(_ live: CGFloat) -> Bool {
        guard let frozenBottomInset else { return true }
        return live >= frozenBottomInset - 0.5
    }

    /// What closing the portal has to do: hand the keyboard back only if it was up to begin with,
    /// and hold the freeze only while that keyboard is still on its way in.
    func closePlan(live: CGFloat) -> ComposerPortalClosePlan {
        guard isEngaged else {
            return ComposerPortalClosePlan(restoresTextFocus: false, waitsForKeyboard: false)
        }
        return ComposerPortalClosePlan(
            restoresTextFocus: restoresTextFocus,
            waitsForKeyboard: restoresTextFocus && !matchesFrozenInset(live)
        )
    }
}

struct ComposerPortalClosePlan: Equatable {
    let restoresTextFocus: Bool
    let waitsForKeyboard: Bool
}

extension View {
    /// Drives the freeze around the composer's attachment portal: engage on open, blur without
    /// reflow, restore the captured focus on close, and release only once the keyboard is back.
    func composerPortalFreeze(
        interaction: ComposerInteraction,
        isTextFocused: FocusState<Bool>.Binding,
        liveBottomInset: CGFloat
    ) -> some View {
        modifier(
            ComposerPortalFreezeModifier(
                interaction: interaction,
                isTextFocused: isTextFocused,
                liveBottomInset: liveBottomInset
            )
        )
    }
}

private struct ComposerPortalFreezeModifier: ViewModifier {
    @Bindable var interaction: ComposerInteraction
    @FocusState.Binding var isTextFocused: Bool
    let liveBottomInset: CGFloat

    /// Safety valve: a keyboard that never comes back must not freeze the chat forever.
    private static let keyboardReturnTimeout = Duration.milliseconds(900)
    /// Below this bottom inset there is no keyboard on screen, only the home-indicator safe area.
    private static let keyboardPresenceThreshold: CGFloat = 100

    @State private var isAwaitingKeyboardReturn = false
    @State private var keyboardReturnGuard: Task<Void, Never>?
    /// Mirror of `liveBottomInset` the guard task can read without capturing a stale value.
    @State private var latestBottomInset: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .onChange(of: interaction.overlay) { previous, overlay in
                if previous == nil, overlay != nil { engage() }
                switch overlay {
                case .photos, .camera:
                    // The freeze is already engaged, so blurring cannot reflow anything.
                    isTextFocused = false
                case .sources:
                    if interaction.portalFreeze.restoresTextFocus { restoreTextFocusDeferred() }
                case nil:
                    if previous != nil { close() }
                }
            }
            .onChange(of: liveBottomInset, initial: true) { _, live in
                latestBottomInset = live
                guard isAwaitingKeyboardReturn,
                    interaction.portalFreeze.matchesFrozenInset(live)
                else { return }
                releaseFreeze()
            }
            .onDisappear { keyboardReturnGuard?.cancel() }
    }

    private func engage() {
        // A close from the previous portal may still be waiting on the keyboard; a new portal
        // takes over the freeze, so that close must not release it mid-lifecycle.
        keyboardReturnGuard?.cancel()
        isAwaitingKeyboardReturn = false
        withTransaction(Transaction(animation: nil)) {
            interaction.portalFreeze.engage(
                bottomInset: liveBottomInset,
                isTextFocused: isTextFocused
            )
        }
    }

    private func close() {
        let plan = interaction.portalFreeze.closePlan(live: liveBottomInset)
        guard plan.restoresTextFocus else {
            releaseFreeze()
            return
        }
        isAwaitingKeyboardReturn = plan.waitsForKeyboard
        keyboardReturnGuard?.cancel()
        keyboardReturnGuard = Task { @MainActor in
            // A focus set inside the same update that tears the portal down flips the FocusState
            // without reliably reaching UIKit's responder chain — the keyboard never rises while
            // SwiftUI believes the field is focused, and a tap then has nothing to change. Hop a
            // runloop turn first so the summon lands after the teardown.
            await Task.yield()
            guard !Task.isCancelled else { return }
            isTextFocused = true
            guard plan.waitsForKeyboard else {
                releaseFreeze()
                return
            }
            try? await Task.sleep(for: Self.keyboardReturnTimeout)
            guard !Task.isCancelled, isAwaitingKeyboardReturn else { return }
            if latestBottomInset < Self.keyboardPresenceThreshold {
                // No keyboard at all: the responder request was swallowed anyway. Cycle the focus
                // once so the second summon starts from a genuine state change.
                isTextFocused = false
                await Task.yield()
                guard !Task.isCancelled, isAwaitingKeyboardReturn else { return }
                isTextFocused = true
                try? await Task.sleep(for: Self.keyboardReturnTimeout)
                guard !Task.isCancelled, isAwaitingKeyboardReturn else { return }
            }
            // Either a keyboard is up at a different height than the frozen one, or it is truly
            // not coming; both end the freeze rather than holding the chat hostage.
            releaseFreeze()
        }
    }

    private func restoreTextFocusDeferred() {
        Task { @MainActor in
            await Task.yield()
            isTextFocused = true
        }
    }

    private func releaseFreeze() {
        isAwaitingKeyboardReturn = false
        keyboardReturnGuard?.cancel()
        keyboardReturnGuard = nil
        withTransaction(Transaction(animation: nil)) { interaction.portalFreeze.release() }
    }
}
