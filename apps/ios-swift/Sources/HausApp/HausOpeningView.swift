import HausUI
import SwiftUI

/// The app-opening screen: the bare surface, matching the empty launch
/// screen, so cold start reads as one quiet held frame until the loaded
/// screen plays its sectioned entrance (`OpeningEntrance`). Deliberately no
/// spinner, caption, or artwork.
struct HausOpeningView: View {
    var body: some View {
        Color(uiColor: .systemBackground)
            .ignoresSafeArea()
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text("Opening Haus"))
    }
}

#Preview {
    HausOpeningView()
}
