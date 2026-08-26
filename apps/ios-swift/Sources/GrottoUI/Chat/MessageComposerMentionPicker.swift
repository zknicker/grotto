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
                            AvatarView(name: option.label, url: option.avatarURL, size: 28)
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
                            Text(option.kind == .agent ? "Agent" : "Human")
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

    private func visibleOptions(_ query: ComposerMentionQuery) -> [MentionOptionPresentation] {
        let term = query.value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !term.isEmpty else { return options }
        return options.filter {
            [$0.label, $0.insertText, $0.detail ?? ""]
                .joined(separator: " ")
                .lowercased()
                .contains(term)
        }
    }
}
