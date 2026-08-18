import SwiftUI

struct ChatSearchView: View {
    @Environment(\.dismiss) private var dismiss

    let chats: [ChatPresentation]
    let onSelectChat: (ChatPresentation) -> Void

    @State private var query = ""
    @State private var searchPresented = true

    var body: some View {
        NavigationStack {
            Group {
                if filteredChats.isEmpty {
                    ContentUnavailableView(
                        "No matches",
                        systemImage: "magnifyingglass",
                        description: Text("Try a channel or Agent name.")
                    )
                } else {
                    List(filteredChats) { chat in
                        Button {
                            dismiss()
                            onSelectChat(chat)
                        } label: {
                            HStack(spacing: 12) {
                                chatIcon(chat)
                                Text(chat.title)
                                    .font(.body)
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)
                                Spacer(minLength: 8)
                                if chat.unreadCount > 0 {
                                    Text("Unread")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .listRowInsets(.init(top: 0, leading: 16, bottom: 0, trailing: 16))
                        .listRowSeparator(.hidden)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Search")
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
#if os(iOS)
            .searchable(
                text: $query,
                isPresented: $searchPresented,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Channels and agents"
            )
#else
            .searchable(text: $query, prompt: "Channels and agents")
#endif
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(GrottoPlatformColor.groupedBackground)
    }

    private var filteredChats: [ChatPresentation] {
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return chats }
        return chats.filter { $0.title.localizedCaseInsensitiveContains(query) }
    }

    @ViewBuilder
    private func chatIcon(_ chat: ChatPresentation) -> some View {
        switch chat.kind {
        case .channel:
            Image(systemName: "number")
                .font(.title3)
                .frame(width: 26, height: 26)
                .foregroundStyle(.secondary)
        case .directMessage(let agent):
            AvatarView(name: agent.name, url: agent.avatarURL, presence: agent.presence, size: 30)
        }
    }
}

#Preview("Chat search") {
    ChatSearchView(chats: ChatFixtures.chats) { _ in }
}
