import Foundation

/// The half of an App appearance override the phone can draw: the hand-written
/// name, and — where the App gives a Skill or a capability a brand's own mark —
/// that glyph and the ink it takes.
///
/// The halves that stay behind are icon bytes no wire form carries: a web
/// link's favicon and a Mac app's bundled icon.
public struct ReferenceAppearance: Hashable, Sendable {
    public let label: String
    public let glyph: GrottoIconName?
    public let brand: ReferenceBrandInk?

    init(_ label: String, glyph: GrottoIconName? = nil, brand: ReferenceBrandInk? = nil) {
        self.label = label
        self.glyph = glyph
        self.brand = brand
    }

    /// The one appearance the App gives more than one key.
    fileprivate static let chrome = ReferenceAppearance(
        "Chrome",
        glyph: .chrome,
        brand: .success
    )
}

/// How a reference reads once it is on screen.
///
/// A reference is drawn with its identity mark, so the `@`, `#`, or `$` the
/// Markdown carries is redundant ink. The stored channel name is a slug — `#`
/// plus the route the Server owns — and a chip shows the channel the way a
/// person says it: `onboarding-owner` reads as `Onboarding Owner`. A skill id
/// reads the same way, through the App's own name formatter. The persisted
/// Markdown and the inserted reference target are untouched; this is
/// presentation only.
public enum ReferenceLabel {
    /// The on-screen label for a reference of `kind`, from either a resolved
    /// identity or the persisted Markdown label. `id` is the reference's own
    /// target identity where the caller has it, which is the first key the
    /// App's hand-written names are looked up under for every kind but `app`.
    public static func display(
        _ label: String,
        kind: MentionPresentationKind,
        id: String? = nil
    ) -> String {
        let bare = strippingSigil(label)
        switch kind {
        case .channel: return channelTitle(bare)
        case .skill: return skillName(bare, id: id)
        case .app, .plugin: return capabilityName(bare, id: lookupID(id, kind: kind))
        default: return bare
        }
    }

    /// A channel's stored name read as a title: dashes and underscores become
    /// spaces and each word opens in upper case. A word that already opens in
    /// upper case is left alone, so `GTM-notes` stays `GTM Notes`.
    public static func channelTitle(_ name: String) -> String {
        strippingSigil(name)
            .split(whereSeparator: { $0 == "-" || $0 == "_" || $0.isWhitespace })
            .map(capitalizingFirst)
            .joined(separator: " ")
    }

    /// The appearance the App names by hand for a reference of `kind`, read
    /// the way `getMentionAppearance` reads its two override tables — under
    /// the keys `getMentionLookupKeys` gives that kind. Every other kind, and
    /// every key the App leaves alone, has none.
    public static func appearance(
        _ label: String,
        kind: MentionPresentationKind,
        id: String? = nil
    ) -> ReferenceAppearance? {
        let bare = strippingSigil(label)
        switch kind {
        case .skill: return override(skillAppearanceOverrides, name: bare, id: id)
        case .app, .plugin:
            return override(capabilityAppearanceOverrides, name: bare, id: lookupID(id, kind: kind))
        default: return nil
        }
    }

    /// A skill id read as its product name, mirroring the App's
    /// `formatSkillName`: a namespace equal to its own suffix drops away, words
    /// come apart on dashes, underscores, and spaces, and each word title-cases
    /// unless it is one of the initialisms the two clients share. A Skill the
    /// App names by hand takes that name instead, the way
    /// `getMentionDisplayLabel` reads its overrides before formatting anything.
    public static func skillName(_ name: String, id: String? = nil) -> String {
        let bare = strippingSigil(name)
        if let override = override(skillAppearanceOverrides, name: bare, id: id) {
            return override.label
        }
        return qualifiedSuffix(bare)
            .split(whereSeparator: { $0 == "-" || $0 == "_" || $0.isWhitespace })
            .map(skillNamePart)
            .joined(separator: " ")
    }

    /// An app or plugin reference's label. The App names a handful of
    /// capabilities by hand and leaves the rest as written, so this is the
    /// override lookup and nothing else.
    public static func capabilityName(_ name: String, id: String? = nil) -> String {
        let bare = strippingSigil(name)
        return override(capabilityAppearanceOverrides, name: bare, id: id)?.label ?? bare
    }

    /// The label without the `@`, `#`, or `$` the Markdown carries.
    public static func strippingSigil(_ label: String) -> String {
        var value = Substring(label)
        while let first = value.first, first == "@" || first == "#" || first == "$" {
            value = value.dropFirst()
        }
        return String(value)
    }

    private static func capitalizingFirst(_ word: Substring) -> String {
        guard let first = word.first, first.isLowercase else { return String(word) }
        return first.uppercased() + word.dropFirst()
    }

    /// `plugin:plugin` names one thing twice; `owner:skill` names two. Only the
    /// redundant prefix is dropped.
    private static func qualifiedSuffix(_ name: String) -> String {
        let parts = name.split(separator: ":", omittingEmptySubsequences: false)
        guard parts.count > 1, let prefix = parts.first, !prefix.isEmpty else { return name }
        let suffix = parts.dropFirst().joined(separator: ":")
        return nameToken(String(prefix)) == nameToken(suffix) ? suffix : name
    }

    private static func nameToken(_ name: String) -> String {
        name
            .split(whereSeparator: { $0 == "-" || $0 == "_" || $0 == ":" || $0.isWhitespace })
            .map { $0.lowercased() }
            .joined(separator: " ")
    }

    private static func skillNamePart(_ part: Substring) -> String {
        let lower = part.lowercased()
        if let override = skillNameOverrides[lower] { return override }
        guard let first = lower.first else { return lower }
        return first.uppercased() + lower.dropFirst()
    }

    /// The App's `skillAppearanceOverrides`: a hand-written name, and the
    /// GitHub mark that comes with it in place of the sparkles.
    private static let skillAppearanceOverrides: [String: ReferenceAppearance] = [
        "gh-issues": ReferenceAppearance("GitHub Issues", glyph: .github),
        "github": ReferenceAppearance("GitHub", glyph: .github),
    ]

    /// The App's `capabilityAppearanceOverrides`. Chrome wears its own mark in
    /// the App's `--success` brand ink; Computer Use is a name alone and keeps
    /// the plug every other capability draws.
    private static let capabilityAppearanceOverrides: [String: ReferenceAppearance] = [
        "chrome": .chrome,
        "chrome@openai-bundled": .chrome,
        "computer-use/google-chrome": .chrome,
        "computer-use@openai-bundled": ReferenceAppearance("Computer Use"),
    ]

    /// The keys the App looks an override up under, from
    /// `getMentionLookupKeys`: an `app` reference is keyed on its label alone,
    /// and every other kind on its own id first, then its label. So a Mac app
    /// is named by the words it was written with — a `com.google.Chrome`
    /// bundle id labeled `Google Chrome` keeps that label and the plug, where
    /// one labeled `Chrome` takes the Chrome name and mark.
    private static func lookupID(_ id: String?, kind: MentionPresentationKind) -> String? {
        kind == .app ? nil : id
    }

    /// The App's key order for every kind but `app`: the reference's own id
    /// first, then its label. A `skill://` or `plugin://` id reaches this
    /// already stripped of its scheme, which is the App's third key.
    private static func override(
        _ table: [String: ReferenceAppearance],
        name: String,
        id: String?
    ) -> ReferenceAppearance? {
        if let id, let match = table[lookupKey(strippingSigil(id))] { return match }
        return table[lookupKey(name)]
    }

    /// The App's `normalizeLookupKey`, minus the sigil strip its caller has
    /// already done.
    private static func lookupKey(_ name: String) -> String {
        name.trimmingCharacters(in: .whitespaces).lowercased()
    }

    /// The initialisms the App spells out in `skill-name-format.ts`, which stays
    /// the source of truth for the pair.
    private static let skillNameOverrides: [String: String] = [
        "ai": "AI",
        "api": "API",
        "ci": "CI",
        "cli": "CLI",
        "codex": "Codex",
        "css": "CSS",
        "csv": "CSV",
        "github": "GitHub",
        "html": "HTML",
        "json": "JSON",
        "llm": "LLM",
        "mcp": "MCP",
        "openai": "OpenAI",
        "pdf": "PDF",
        "pr": "PR",
        "sdk": "SDK",
        "ui": "UI",
        "url": "URL",
    ]
}
