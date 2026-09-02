import SwiftUI

/// What a live-updating prepared action shows: still on screen, collapsing out
/// after just having gone superseded, or gone for good — either finished
/// collapsing, or superseded from its very first render, which never animates.
enum ActionCardVisibility: Equatable {
    case exiting
    case hidden
    case live

    /// One canonical decision, kept pure so the transition rule is testable
    /// without mounting a view.
    static func resolve(
        hidden: Bool,
        superseded: Bool,
        wasVisible: Bool
    ) -> ActionCardVisibility {
        if hidden { return .hidden }
        if !superseded { return .live }
        return wasVisible ? .exiting : .hidden
    }
}

/// Collapses a card out of the transcript instead of popping it away.
///
/// A prepared action goes from on screen to superseded while the human is
/// looking at it, so the card's height and opacity animate together over 200ms
/// and `onExited` unmounts it for good. Reduced motion skips straight to the
/// removal: the row still leaves, it just does not travel.
///
/// The collapse needs a number to animate toward zero from, and a card sized by
/// its own content has none until it has been laid out — so the measured height
/// is adopted first and the collapse begins on the following turn, when there is
/// a real value to leave.
struct ActionCardExitView<Content: View>: View {
    let onExited: () -> Void
    @ViewBuilder let content: () -> Content

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var height: CGFloat?
    @State private var collapsed = false
    /// The collapse outlives one frame, so it is held rather than fired and
    /// forgotten: a row that leaves the screen mid-collapse — the transcript
    /// recycling its cell, a Chat switch — must not report an exit afterwards
    /// against whatever action the view now carries.
    @State private var collapse: Task<Void, Never>?

    private static var duration: Double { 0.2 }

    var body: some View {
        content()
            .fixedSize(horizontal: false, vertical: true)
            .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.size.height
            } action: { measured in
                adopt(measured)
            }
            .frame(height: collapsed ? 0 : height, alignment: .top)
            .opacity(collapsed ? 0 : 1)
            .clipped()
            .task {
                guard reduceMotion else { return }
                onExited()
            }
            .onDisappear {
                collapse?.cancel()
                collapse = nil
            }
    }

    private func adopt(_ measured: CGFloat) {
        guard height == nil, measured > 0, !reduceMotion else { return }
        height = measured
        collapse = Task { @MainActor in
            withAnimation(.easeOut(duration: Self.duration)) { collapsed = true }
            try? await Task.sleep(for: .seconds(Self.duration + 0.02))
            guard !Task.isCancelled else { return }
            onExited()
        }
    }
}
