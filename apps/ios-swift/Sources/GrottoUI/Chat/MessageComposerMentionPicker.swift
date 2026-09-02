import SwiftUI

struct MessageComposerMentionPicker: View {
    @Binding var text: String
    let options: [MentionOptionPresentation]

    var body: some View {
        if let query = ComposerMentionQuery.active(in: text), !visibleOptions(query).isEmpty {
            VStack(spacing: 0) {
                ForEach(visibleOptions(query).prefix(6)) { option in
                    Button {
                        text = query.inserting(option, into: text)
                    } label: {
                        HStack(spacing: 10) {
                            mark(for: option)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(option.insertText)
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(.primary)
                                if let detail = option.detail {
                                    Text(detail)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                            }
                            Spacer(minLength: 0)
                            Text(kindLabel(option.kind))
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.horizontal, 12)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .background(GrottoPlatformColor.inputSurface, in: .rect(cornerRadius: 16))
            .padding(.horizontal, 12)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    @ViewBuilder
    private func mark(for option: MentionOptionPresentation) -> some View {
        switch option.kind {
        case .channel:
            ChannelIconBox(appearance: option.channelAppearance ?? .default, size: 28)
        case .agent, .human:
            AvatarView(name: option.label, url: option.avatarURL, size: 28)
        }
    }

    private func kindLabel(_ kind: MentionPresentationKind) -> String {
        switch kind {
        case .agent: "Agent"
        case .channel: "Channel"
        case .human: "Human"
        }
    }

    /// The trigger chooses the roster: `@` addresses Agents and humans, `#`
    /// addresses channels. The typed term then filters within it.
    private func visibleOptions(_ query: ComposerMentionQuery) -> [MentionOptionPresentation] {
        let triggered = options.filter { matches(kind: $0.kind, trigger: query.trigger) }
        let term = query.value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !term.isEmpty else { return triggered }
        return triggered.filter {
            [$0.label, $0.insertText, $0.detail ?? ""]
                .joined(separator: " ")
                .lowercased()
                .contains(term)
        }
    }

    private func matches(kind: MentionPresentationKind, trigger: Character) -> Bool {
        switch kind {
        case .channel: trigger == "#"
        case .agent, .human: trigger == "@"
        }
    }
}
