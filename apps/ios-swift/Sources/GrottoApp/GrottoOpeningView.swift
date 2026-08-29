import GrottoUI
import SwiftUI

/// The app-opening screen: the Grotto character alone on the plain surface,
/// blinking while the Store loads. It replaces spinner-and-caption loading
/// chrome and matches the empty launch screen so cold start reads as one
/// continuous surface.
struct GrottoOpeningView: View {
    var body: some View {
        GrottoCharacterMark()
            .frame(width: 96)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(uiColor: .systemBackground))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text("Opening Grotto"))
    }
}

#Preview {
    GrottoOpeningView()
}
