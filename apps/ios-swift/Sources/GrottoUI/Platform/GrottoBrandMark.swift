import SwiftUI

/// Grotto's brand mark — a rendering of the app icon (`assets/mac-icon.icon`):
/// a rounded-square tile filled with the icon's deep-blue background gradient,
/// with the blob silhouette layered on top in white, matching `icon.json`.
public struct GrottoBrandMark: View {
    /// Background gradient from `icon.json`'s `fill.linear-gradient`, converted
    /// from Display P3 to `Color` values.
    private static let topColor = Color(.displayP3, red: 0.02540, green: 0.23240, blue: 0.65473)
    private static let bottomColor = Color(.displayP3, red: 0.00831, green: 0.09829, blue: 0.28572)

    /// iOS app-icon corner ratio (corner radius / side length).
    private static let cornerRatio: CGFloat = 0.2237

    /// Icon Composer places a layer inside an implicit safe area before applying
    /// `icon.json`'s own scale, rather than fitting it edge-to-edge in the
    /// canvas. `GrottoMark.svg`'s viewBox already tightly wraps the blob, so a
    /// plain `aspectRatio(.fit)` fills the whole tile; this base fraction
    /// reproduces that default inset (calibrated against the exported app icon).
    private static let markBaseFraction: CGFloat = 0.671

    /// The "Vector" layer's scale and translation from `icon.json`, expressed
    /// relative to the 1024pt icon canvas the values were authored against.
    private static let markScale: CGFloat = 1.13
    private static let markOffsetXRatio: CGFloat = 12.76023816672495 / 1024
    private static let markOffsetYRatio: CGFloat = -7.137749425136645 / 1024
    private static let markOpacity: Double = 0.97

    public init() {}

    public var body: some View {
        GeometryReader { proxy in
            let side = min(proxy.size.width, proxy.size.height)

            RoundedRectangle(cornerRadius: side * Self.cornerRatio, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Self.topColor, Self.bottomColor],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .overlay(
                    Image("GrottoMark", bundle: .module)
                        .renderingMode(.template)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .foregroundStyle(.white)
                        .opacity(Self.markOpacity)
                        .scaleEffect(Self.markBaseFraction * Self.markScale)
                        .offset(
                            x: side * Self.markOffsetXRatio,
                            y: side * Self.markOffsetYRatio
                        )
                )
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityHidden(true)
    }
}

#Preview {
    GrottoBrandMark()
        .frame(width: 96, height: 96)
        .padding()
}
