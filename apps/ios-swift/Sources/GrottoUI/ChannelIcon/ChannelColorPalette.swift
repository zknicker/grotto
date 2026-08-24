import SwiftUI

/// A channel's chosen appearance as the Server stores it: `icon` is a curated
/// hugeicons export name (`RocketIcon`), `color` a palette preset id
/// (`violet`). Both null means the default hash in a muted box.
public struct ChannelAppearance: Hashable, Sendable {
    public static let `default` = ChannelAppearance(icon: nil, color: nil)

    public let icon: String?
    public let color: String?

    public init(icon: String?, color: String?) {
        self.icon = icon
        self.color = color
    }
}

/// One channel color preset. `light` and `dark` are the glyph tints; the box
/// background is the same tint at a low alpha.
public struct ChannelColorPreset: Hashable, Sendable {
    public let id: String
    public let light: Color
    public let dark: Color

    public func tint(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? dark : light
    }

    /// The App derives the box from the glyph tint with `color-mix` at 11%
    /// light / 13% dark. Alpha over the surface is the same result here.
    public func boxFill(_ scheme: ColorScheme) -> Color {
        tint(scheme).opacity(scheme == .dark ? 0.13 : 0.11)
    }
}

/// The 18 channel color presets, mirroring
/// `apps/website/src/components/chats/channel-color-options.ts`, which stays the
/// source of truth. Channels store the preset id, so changing a hex here
/// restyles every channel that already picked that preset.
public enum ChannelColorPalette {
    public static let presets: [ChannelColorPreset] = [
        preset("slate", light: 0x475569, dark: 0x94A3B8),
        preset("red", light: 0xDC2626, dark: 0xF87171),
        preset("orange", light: 0xEA580C, dark: 0xFB923C),
        preset("amber", light: 0xD97706, dark: 0xFBBF24),
        preset("yellow", light: 0xCA8A04, dark: 0xFACC15),
        preset("lime", light: 0x65A30D, dark: 0xA3E635),
        preset("green", light: 0x16A34A, dark: 0x4ADE80),
        preset("emerald", light: 0x059669, dark: 0x34D399),
        preset("teal", light: 0x0D9488, dark: 0x2DD4BF),
        preset("cyan", light: 0x0891B2, dark: 0x22D3EE),
        preset("sky", light: 0x0284C7, dark: 0x38BDF8),
        preset("blue", light: 0x2563EB, dark: 0x60A5FA),
        preset("indigo", light: 0x4F46E5, dark: 0x818CF8),
        preset("violet", light: 0x7C3AED, dark: 0xA78BFA),
        preset("purple", light: 0x9333EA, dark: 0xC084FC),
        preset("fuchsia", light: 0xC026D3, dark: 0xE879F9),
        preset("pink", light: 0xDB2777, dark: 0xF472B6),
        preset("rose", light: 0xE11D48, dark: 0xFB7185),
    ]

    /// The preset for a stored id, or nil for an unset or unknown color. An
    /// unknown id renders the muted default rather than inventing a tint.
    public static func preset(for color: String?) -> ChannelColorPreset? {
        guard let color else { return nil }
        let normalized = color.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return presetsByID[normalized]
    }

    private static let presetsByID: [String: ChannelColorPreset] = Dictionary(
        presets.map { ($0.id, $0) },
        uniquingKeysWith: { first, _ in first }
    )

    private static func preset(_ id: String, light: UInt32, dark: UInt32) -> ChannelColorPreset {
        ChannelColorPreset(id: id, light: Color(hex: light), dark: Color(hex: dark))
    }
}

private extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
