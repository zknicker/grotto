import SwiftUI

/// One kind's header and its rows.
struct MentionPickerSectionView: View {
    let section: MentionPickerSection
    let activeOptionID: String?
    let onSelect: (MentionOptionPresentation) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(section.title)
                .font(.caption)
                .foregroundStyle(GrottoPlatformColor.secondaryLabel)
                .frame(height: MentionPickerLayout.headerHeight, alignment: .leading)
                .padding(.horizontal, MentionPickerLayout.highlightInset + MentionPickerLayout.rowInset)
                .accessibilityAddTraits(.isHeader)

            ForEach(section.options) { option in
                MentionPickerRow(
                    option: option,
                    isActive: option.id == activeOptionID,
                    onSelect: { onSelect(option) }
                )
            }
        }
    }
}

/// A single autocomplete row: identity mark, then the name as a person says it.
///
/// No kind caption and no description line — the section header above already names the kind, and
/// every description the Server sends for these rows is a restatement of it.
struct MentionPickerRow: View {
    let option: MentionOptionPresentation
    let isActive: Bool
    let onSelect: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: MentionPickerLayout.markGap) {
                mark
                Text(ReferenceLabel.display(option.label, kind: option.kind))
                    .font(.body)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, MentionPickerLayout.rowInset)
            .frame(height: MentionPickerLayout.rowHeight)
            .background(highlight)
            .padding(.horizontal, MentionPickerLayout.highlightInset)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var highlight: some View {
        if isActive {
            RoundedRectangle(
                cornerRadius: MentionPickerLayout.highlightCornerRadius,
                style: .continuous
            )
            // The same low-alpha wash of the foreground `ChannelIconBox` fills its box with, so
            // the highlight sits on glass in either scheme without becoming a grey slab.
            .fill(Color.primary.opacity(colorScheme == .dark ? 0.12 : 0.075))
        }
    }

    @ViewBuilder
    private var mark: some View {
        switch option.kind {
        case .channel:
            ChannelIconBox(
                appearance: option.channelAppearance ?? .default,
                size: MentionPickerLayout.markSize
            )
        case .agent, .human:
            AvatarView(
                name: option.label,
                url: option.avatarURL,
                size: MentionPickerLayout.markSize
            )
        }
    }
}
