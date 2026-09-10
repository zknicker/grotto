import Foundation
@testable import HausUI
import SwiftUI
import Testing

/// Label shaping, which is where the two clients most easily drift.
struct ReferenceLabelShapingTests {
    @Test func readsSkillIdsAsProductNames() {
        #expect(ReferenceLabel.skillName("$ui") == "UI")
        #expect(ReferenceLabel.skillName("agent-browser") == "Agent Browser")
        #expect(ReferenceLabel.skillName("gh-issues") == "GitHub Issues")
        #expect(ReferenceLabel.skillName("openai-sdk") == "OpenAI SDK")
        // A namespace that repeats its own skill drops away; one that names a
        // different owner stays.
        #expect(ReferenceLabel.skillName("ui:ui") == "UI")
        #expect(ReferenceLabel.skillName("cowork:plugin-customizer") == "Cowork:plugin Customizer")
    }

    /// The App names a few Skills and capabilities by hand before it formats
    /// anything, so the phone reads the same names.
    @Test func readsTheNamesTheAppSpellsOutByHand() {
        #expect(ReferenceLabel.display("$github", kind: .skill) == "GitHub")
        #expect(ReferenceLabel.display("$gh-issues", kind: .skill) == "GitHub Issues")
        #expect(ReferenceLabel.display("@Chrome", kind: .app) == "Chrome")
        #expect(ReferenceLabel.display("computer-use/google-chrome", kind: .plugin) == "Chrome")
        #expect(
            ReferenceLabel.display("computer-use@openai-bundled", kind: .plugin) == "Computer Use"
        )
        // The reference's own target is a key too, ahead of its words.
        #expect(
            ReferenceLabel
                .display("Google Chrome", kind: .plugin, id: "computer-use/google-chrome")
                == "Chrome"
        )
        // Everything the App leaves alone stays as written.
        #expect(ReferenceLabel.display("merchbase", kind: .plugin) == "merchbase")
    }

    /// `getMentionLookupKeys` keys an `app` reference on its label alone, so a
    /// Mac app's bundle id never reaches the override table and the words the
    /// reference was written with decide the name.
    @Test func readsAMacAppByItsWordsAndEveryOtherKindByItsTargetFirst() {
        #expect(
            ReferenceLabel.display("Chrome", kind: .app, id: "com.google.Chrome") == "Chrome"
        )
        #expect(
            ReferenceLabel.display("Google Chrome", kind: .app, id: "com.google.Chrome")
                == "Google Chrome"
        )
        #expect(
            ReferenceLabel.appearance("Google Chrome", kind: .app, id: "computer-use/google-chrome")
                == nil
        )
        // The same id under the plugin kind still wins over the label.
        #expect(
            ReferenceLabel.appearance(
                "Google Chrome",
                kind: .plugin,
                id: "computer-use/google-chrome"
            )?.glyph == .chrome
        )
    }

    @Test func stripsEverySigilTheMarkdownCarries() {
        #expect(ReferenceLabel.display("@Ada Lovelace", kind: .human) == "Ada Lovelace")
        #expect(ReferenceLabel.display("$design", kind: .skill) == "Design")
        #expect(ReferenceLabel.display("#product", kind: .channel) == "Product")
        // A path reference keeps its link text as written, sigil aside — it is
        // not a skill even when it points at one.
        #expect(ReferenceLabel.display("$ui", kind: .file) == "ui")
    }

    @Test func readsAPullRequestNumberOutOfEveryGitHubShapedURL() {
        #expect(RichReferenceWireForm
            .pullRequestNumber(in: "https://github.com/haus/haus/pull/56") == 56)
        #expect(RichReferenceWireForm
            .pullRequestNumber(in: "https://api.github.com/repos/haus/haus/pulls/56") == 56)
        #expect(RichReferenceWireForm
            .pullRequestNumber(in: "https://github.com/haus/haus/pull/56/files") == 56)
        #expect(RichReferenceWireForm
            .pullRequestNumber(in: "https://github.com/haus/haus/pull/0") == nil)
        #expect(RichReferenceWireForm
            .pullRequestNumber(in: "https://github.com/haus/haus/tree/main") == nil)
    }

    @Test func labelsAWebsiteByItsWordsAndAWordlessOneByItsHost() {
        #expect(websiteLabel(text: "the notes", target: "https://haus.dev/x") == "the notes")
        #expect(websiteLabel(text: "https://haus.dev/x", target: "https://haus.dev/x") == "haus.dev")
        #expect(websiteLabel(text: "https://www.haus.dev", target: "https://www.haus.dev") == "haus.dev")
    }

    private func websiteLabel(text: String, target: String) -> String? {
        RichReferenceWireForm.read(target: target, text: text)?.label
    }
}

/// The appearance overrides, which are the labels' other half: the mark a few
/// of those hand-written names bring with them.
struct ReferenceAppearanceTests {
    @Test func givesTheGitHubSkillsTheirOwnMarkInTheSkillsOwnInk() {
        #expect(ReferenceLabel.appearance("gh-issues", kind: .skill)?.glyph == .github)
        #expect(ReferenceLabel.appearance("$github", kind: .skill)?.glyph == .github)
        #expect(ReferenceLabel.appearance("gh-issues", kind: .skill)?.brand == nil)
    }

    /// Chrome is the one brand the App inks by hand, in `--success`.
    @Test func inksEveryChromeKeyWithTheAppsBrandColor() {
        for key in ["chrome", "chrome@openai-bundled", "computer-use/google-chrome"] {
            let appearance = ReferenceLabel.appearance(key, kind: .app)
            #expect(appearance?.glyph == .chrome, "glyph for \(key)")
            #expect(appearance?.brand == .success, "brand for \(key)")
        }
        #expect(
            ReferenceBrandInk.success.color
                == Color(red: 0x17 / 255, green: 0xC9 / 255, blue: 0x64 / 255)
        )
    }

    /// The App puts `brandColor` on `--chip-fg`, which is the whole chip
    /// foreground, so a brand's ink carries the label as well as the mark. A
    /// reference the App names no brand for keeps its kind's own ink.
    @Test func inksABrandReferencesLabelAndNotAnUnbrandedOnes() {
        let chrome = RichReferencePresentation(
            id: "computer-use/google-chrome",
            kind: .plugin,
            label: "Chrome",
            avatarURL: nil
        )
        #expect(chrome.mark == .brandGlyph(.chrome, .success))
        #expect(
            RichReferenceChipInk.labelTint(for: chrome)
                == RichReferenceChipInk.brandTint(.success)
        )

        let github = RichReferencePresentation(
            id: "gh-issues",
            kind: .skill,
            label: "gh-issues",
            avatarURL: nil
        )
        #expect(github.mark == .glyph(.github))
        #expect(
            RichReferenceChipInk.labelTint(for: github)
                == RichReferenceChipInk.labelTint(
                    for: RichReferencePresentation(
                        id: "deslop",
                        kind: .skill,
                        label: "deslop",
                        avatarURL: nil
                    )
                )
        )
        #expect(
            RichReferenceChipInk.labelTint(for: github)
                != RichReferenceChipInk.brandTint(.success)
        )
    }

    /// A capability the App renames but leaves unmarked keeps the plug, and a
    /// kind the App writes no overrides for has no appearance at all.
    @Test func leavesEveryUnnamedReferenceItsOwnKindMark() {
        #expect(
            ReferenceLabel.appearance("computer-use@openai-bundled", kind: .plugin)?.glyph == nil
        )
        #expect(ReferenceLabel.appearance("merchbase", kind: .plugin) == nil)
        #expect(ReferenceLabel.appearance("github", kind: .channel) == nil)
    }
}
