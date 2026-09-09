import SwiftUI

/// The App's `--skill-reference` product token.
///
/// iOS has no semantic color for it, so the two ramp stops the token resolves
/// to are named once, here, for every surface that draws a Skill: purple-700 on
/// a light page, purple-400 on a dark one.
public enum SkillReferenceInk {
    public static let light = Color(red: 0x7E / 255, green: 0x22 / 255, blue: 0xCE / 255)
    public static let dark = Color(red: 0xC0 / 255, green: 0x84 / 255, blue: 0xFC / 255)

    public static func tint(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? dark : light
    }
}
