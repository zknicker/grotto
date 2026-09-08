import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

/// The body and code sizes a visual's document renders at.
///
/// This is the one place the iOS card deliberately diverges from the generated
/// token snapshot. The web ties `--app-ui-font-size` to the web chat's own
/// 14px body, so a card reads at the size of the transcript around it. The iOS
/// transcript is SF `.body` — 17pt at the default Dynamic Type size — so the
/// snapshotted 14px would read visibly small beside it. iOS therefore resolves
/// both sizes from the current Dynamic Type size and overrides the two token
/// values; every other token stays exactly as generated.
///
/// `.callout` carries the code size because it is the closest iOS text style to
/// the web's 13:14 code-to-body ratio (0.929): at the default size `.callout`
/// is 16pt against `.body`'s 17pt, a ratio of 0.941, where `.subheadline`'s
/// 15pt gives 0.882 — nearly four times further from the web's ratio.
struct VisualTypography: Hashable, Sendable {
    let uiFontSize: Double
    let codeFontSize: Double

    /// The web's own sizes, used wherever there is no UIKit to ask.
    static let web = VisualTypography(uiFontSize: 14, codeFontSize: 13)

    /// The `:root` declarations that override the generated token values. They
    /// are emitted after the token table so source order settles the conflict.
    var declarations: String {
        [
            "--app-ui-font-size: \(Self.css(uiFontSize));",
            "--app-code-font-size: \(Self.css(codeFontSize));",
        ].joined(separator: "\n")
    }

    static func resolved(for size: DynamicTypeSize) -> VisualTypography {
        #if canImport(UIKit)
        let traits = UITraitCollection(preferredContentSizeCategory: contentSizeCategory(for: size))
        return VisualTypography(
            uiFontSize: UIFont.preferredFont(forTextStyle: .body, compatibleWith: traits).pointSize,
            codeFontSize: UIFont.preferredFont(forTextStyle: .callout, compatibleWith: traits)
                .pointSize
        )
        #else
        return web
        #endif
    }

    /// A CSS pixel length: whole points stay whole so the declaration reads the
    /// way the platform states the size.
    static func css(_ value: Double) -> String {
        let rounded = (value * 100).rounded() / 100
        return rounded == rounded.rounded() ? "\(Int(rounded))px" : "\(rounded)px"
    }
}

#if canImport(UIKit)
private extension VisualTypography {
    static func contentSizeCategory(for size: DynamicTypeSize) -> UIContentSizeCategory {
        switch size {
        case .xSmall: .extraSmall
        case .small: .small
        case .medium: .medium
        case .large: .large
        case .xLarge: .extraLarge
        case .xxLarge: .extraExtraLarge
        case .xxxLarge: .extraExtraExtraLarge
        case .accessibility1: .accessibilityMedium
        case .accessibility2: .accessibilityLarge
        case .accessibility3: .accessibilityExtraLarge
        case .accessibility4: .accessibilityExtraExtraLarge
        case .accessibility5: .accessibilityExtraExtraExtraLarge
        @unknown default: .large
        }
    }
}
#endif
