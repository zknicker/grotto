import SwiftUI

/// The shared circular icon control for app chrome.
///
/// This view owns its visible geometry so toolbars and floating placements
/// render the same 44-point circle.
struct GlassChromeButton<Label: View>: View {
    let action: () -> Void
    @ViewBuilder let label: () -> Label

    init(
        action: @escaping () -> Void,
        @ViewBuilder label: @escaping () -> Label
    ) {
        self.action = action
        self.label = label
    }

    @ViewBuilder
    var body: some View {
        if #available(iOS 26, macOS 26, *) {
            standardButton
                .glassEffect(.regular.interactive(), in: .circle)
        } else {
            standardButton
                .background(.regularMaterial, in: .circle)
        }
    }

    private var standardButton: some View {
        Button(action: action) {
            label()
                .frame(width: 24, height: 24)
                .frame(width: 44, height: 44)
                .contentShape(.circle)
        }
        .buttonStyle(.plain)
        .foregroundStyle(GrottoPlatformColor.label)
        .frame(width: 44, height: 44)
    }
}
