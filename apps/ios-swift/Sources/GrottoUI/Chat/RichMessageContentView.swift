import SwiftUI

/// A message body: its words and its `@mention` chips in one run of text.
///
/// A mention is a run of the sentence, not a picture of one. It is set in the
/// body font at the body size on the body's own baseline, and the capsule and
/// identity mark are painted behind it by the text engine — so the words after
/// a chip keep their rhythm, a chip's line keeps the pitch of a plain line, and
/// a selection drags straight through the mention.
struct RichMessageContentView: View {
    let segments: [RichMessageSegment]
    var textStyle: Font.TextStyle = .body

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.legibilityWeight) private var legibilityWeight
    /// Avatars arrive after the first frame. Recording the ones that landed
    /// invalidates this body, which repaints those marks with the image in
    /// place of their initials. It is an invalidation trigger only; whether an
    /// avatar is drawable is `AvatarImageCache`'s answer.
    @State private var loadedAvatarURLs: Set<URL> = []

    var body: some View {
        content
            .task { ChannelIconCatalog.shared.load() }
            .task(id: avatarURLs) { await loadAvatars() }
    }

    #if canImport(UIKit)
    private var content: some View {
        RichMessageTextView(
            content: RichMessageTextView.Content(
                segments: segments,
                textStyle: textStyle,
                dynamicTypeSize: dynamicTypeSize,
                legibilityWeight: legibilityWeight
            ),
            markRevision: markRevision
        )
    }

    /// Everything a mark's pixels depend on beyond the text itself. The
    /// avatar's presence is `AvatarImageCache`'s answer alone, never a
    /// per-view set: the cache restores an evicted avatar from its disk bytes
    /// and only reports absence once those are gone too, so a recycled row
    /// cannot flip a drawn avatar back to initials. Reading the channel
    /// catalog here is also what subscribes this body to its one-time load.
    private var markRevision: Int {
        var hasher = Hasher()
        hasher.combine(loadedAvatarURLs)
        for case .reference(let reference) in segments {
            if let url = reference.avatarURL {
                hasher.combine(AvatarImageCache.shared.image(for: url) != nil)
            }
            if reference.kind == .channel {
                let appearance = reference.channelAppearance ?? .default
                hasher.combine(ChannelIconCatalog.shared.subpaths(for: appearance.icon) != nil)
            }
        }
        return hasher.finalize()
    }
    #else
    /// macOS hosts this package so the pure tests can run. There is no text
    /// engine work here — the labels read as plain words, without a capsule.
    private var content: some View {
        segments
            .reduce(Text(verbatim: "")) { text, segment in
                switch segment {
                case .text(let run):
                    text + Text(verbatim: run)
                case .reference(let reference):
                    text + Text(verbatim: reference.label).fontWeight(.medium)
                }
            }
            .font(.system(textStyle))
            .textSelection(.enabled)
            .accessibilityLabel(RichMessageAttributedText.accessibilityLabel(for: segments))
    }
    #endif

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
}
