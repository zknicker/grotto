import SwiftUI

/// A message body as one `Text`: its words and its reference chips on the same
/// lines, wrapping together.
///
/// Each chip is rasterized by `RichReferenceChipRaster` and concatenated into
/// the body as an image run, which is how the App's `align-middle` chip span
/// reads on the web. Laying the segments out as sibling views cannot do that —
/// a multi-word run measures at the full column width, so the chip and every
/// word after it are pushed onto their own lines.
struct RichMessageContentView: View {
    let segments: [RichMessageSegment]
    var textStyle: Font.TextStyle = .body

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.displayScale) private var displayScale
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.legibilityWeight) private var legibilityWeight
    /// Avatars arrive after the first frame. Recording the ones that landed
    /// invalidates this body, which re-rasterizes those chips with the image in
    /// place of their initials. It is an invalidation trigger only; whether an
    /// avatar is drawable is `AvatarImageCache`'s answer.
    @State private var loadedAvatarURLs: Set<URL> = []

    var body: some View {
        content
            .font(.system(textStyle))
            .textSelection(.enabled)
            .accessibilityLabel(accessibilityLabel)
            .task { ChannelIconCatalog.shared.load() }
            .task(id: avatarURLs) { await loadAvatars() }
    }

    private var content: Text {
        var text = Text(verbatim: "")
        for segment in segments {
            switch segment {
            case .text(let run):
                text = text + Text(verbatim: run)
            case .reference(let reference):
                text = text + chipText(for: reference)
            }
        }
        return text
    }

    private func chipText(for reference: RichReferencePresentation) -> Text {
        guard let chip = RichReferenceChipRaster.shared.image(
            for: reference,
            style: style(for: reference)
        ) else {
            // A chip that cannot be drawn still has to read as its label.
            return Text(verbatim: reference.label)
        }
        return Text(Image(decorative: chip.image, scale: displayScale))
            .baselineOffset(chipFit.baselineOffset)
    }

    /// The chip is sized and dropped so its line keeps the pitch of a plain
    /// line; `InlineChipFit` carries that arithmetic and its reasons.
    private var chipFit: InlineChipFit {
        InlineChipFit(metrics: textMetrics, displayScale: displayScale)
    }

    /// The box from the fit, and the label size taken from the very font these
    /// words are set in, so a chip reads as a highlighted run of the sentence
    /// rather than a smaller sentence of its own.
    private var chipProportions: RichReferenceChipProportions {
        RichReferenceChipProportions(
            height: chipFit.height,
            textPointSize: textMetrics.pointSize
        )
    }

    private var textMetrics: PlatformFontMetrics {
        PlatformTextMetrics.metrics(for: textStyle, dynamicTypeSize: dynamicTypeSize)
    }

    private func style(for reference: RichReferencePresentation) -> RichReferenceChipStyle {
        RichReferenceChipStyle(
            colorScheme: colorScheme,
            displayScale: displayScale,
            dynamicTypeSize: dynamicTypeSize,
            legibilityWeight: legibilityWeight,
            proportions: chipProportions,
            hasAvatarImage: hasAvatarImage(reference),
            hasChannelGlyph: hasChannelGlyph(reference)
        )
    }

    /// The cache is the only truth here. Asking a per-view `@State` set as well
    /// would let the key fall back to false the moment `AvatarImageCache`
    /// evicts, and a recycled row would raster initials over an avatar it had
    /// already drawn.
    private func hasAvatarImage(_ reference: RichReferencePresentation) -> Bool {
        guard let url = reference.avatarURL else { return false }
        return AvatarImageCache.shared.image(for: url) != nil
    }

    /// Reading the catalog here rather than inside the rasterized chip both
    /// keys the bitmap and subscribes this body to the one-time glyph load —
    /// observation a view rendered by `ImageRenderer` never receives.
    private func hasChannelGlyph(_ reference: RichReferencePresentation) -> Bool {
        guard reference.kind == .channel else { return false }
        let appearance = reference.channelAppearance ?? .default
        return ChannelIconCatalog.shared.subpaths(for: appearance.icon) != nil
    }

    private var avatarURLs: [URL] {
        segments.compactMap { segment in
            guard case .reference(let reference) = segment else { return nil }
            return reference.avatarURL
        }
    }

    private func loadAvatars() async {
        for url in avatarURLs where AvatarImageCache.shared.image(for: url) == nil {
            guard await AvatarImageCache.shared.load(url: url) != nil else { continue }
            loadedAvatarURLs.insert(url)
        }
    }

    /// The body reads as its words with each chip named in place, so a rendered
    /// image run never reaches VoiceOver as an unlabeled attachment.
    private var accessibilityLabel: String {
        segments.map { segment in
            switch segment {
            case .text(let run):
                run
            case .reference(let reference):
                "\(reference.kind.referenceKindLabel) reference, \(reference.label)"
            }
        }
        .joined()
    }
}
