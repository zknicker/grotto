import GrottoUI
import SwiftUI

/// The app-opening screen: the Grotto character in his app-icon colors on the
/// icon's blue gradient, blinking while the Store loads. It replaces
/// spinner-and-caption loading chrome and looks the same in light and dark
/// mode, because the character keeps his icon palette rather than adapting to
/// the color scheme.
struct GrottoOpeningView: View {
    var body: some View {
        ZStack {
            GrottoBrandColors.iconGradient
                .ignoresSafeArea()
            GrottoCharacterMark()
                .frame(width: 96)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Opening Grotto"))
    }
}

#Preview {
    GrottoOpeningView()
}
