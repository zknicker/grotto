import SwiftUI

public struct ChatSidebarView: View {
    private let server: ServerPresentation
    private let chats: [ChatPresentation]
    private let selectedChatID: String?
    private let onSelectChat: (ChatPresentation) -> Void
    private let onOpenSettings: () -> Void
    private let onOpenArchived: () -> Void
    private let onOpenNewChannel: () -> Void

    @State private var channelsExpanded = true
    @State private var directMessagesExpanded = true
    @State private var searchPresented = false

    public init(
        server: ServerPresentation,
        chats: [ChatPresentation],
        selectedChatID: String?,
        onSelectChat: @escaping (ChatPresentation) -> Void,
        onOpenSettings: @escaping () -> Void,
        onOpenArchived: @escaping () -> Void = {},
        onOpenNewChannel: @escaping () -> Void = {}
    ) {
        self.server = server
        self.chats = chats
        self.selectedChatID = selectedChatID
        self.onSelectChat = onSelectChat
        self.onOpenSettings = onOpenSettings
        self.onOpenArchived = onOpenArchived
        self.onOpenNewChannel = onOpenNewChannel
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Button(action: onOpenSettings) {
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 5) {
                        Text(server.name).font(.title3.weight(.semibold))
                        Image(systemName: "chevron.right")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    Text(serverCounts)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)

            Button {
                searchPresented = true
            } label: {
                Label("Search", systemImage: "magnifyingglass")
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 14)
                    .frame(height: 44)
                    .background(.quaternary, in: .capsule)
            }
            .buttonStyle(.plain)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 5) {
                    sectionHeader(
                        "Channels",
                        isExpanded: $channelsExpanded,
                        trailingAction: onOpenNewChannel
                    )
                    if channelsExpanded {
                        ForEach(channels) { row($0) }
                    }

                    sectionHeader("Direct messages", isExpanded: $directMessagesExpanded)
                        .padding(.top, 6)
                    if directMessagesExpanded {
                        ForEach(directMessages) { row($0) }
                    }

                    Button(action: onOpenArchived) {
                        Label("Archived", systemImage: "archivebox")
                            .foregroundStyle(.primary)
                            .padding(.horizontal, 12)
                            .frame(maxWidth: .infinity, minHeight: 42, alignment: .leading)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .scrollIndicators(.hidden)
        }
        .padding(.horizontal, 20)
        .padding(.top, 18)
        .background(GrottoPlatformColor.background)
        .sheet(isPresented: $searchPresented) {
            ChatSearchView(chats: chats) { chat in
                searchPresented = false
                onSelectChat(chat)
            }
        }
    }

    private var channels: [ChatPresentation] {
        chats.filter { if case .channel = $0.kind { true } else { false } }
    }

    private var directMessages: [ChatPresentation] {
        chats.filter { if case .directMessage = $0.kind { true } else { false } }
    }

    private var serverCounts: String {
        "\(server.agentCount) \(server.agentCount == 1 ? "Agent" : "Agents") · "
            + "\(server.memberCount) \(server.memberCount == 1 ? "Member" : "Members")"
    }

    @ViewBuilder
    private func sectionHeader(
        _ title: String,
        isExpanded: Binding<Bool>,
        trailingAction: (() -> Void)? = nil
    ) -> some View {
        HStack(spacing: 4) {
            Button {
                withAnimation(.snappy) { isExpanded.wrappedValue.toggle() }
            } label: {
                Image(systemName: "chevron.down")
                    .font(.caption2.weight(.semibold))
                    .rotationEffect(.degrees(isExpanded.wrappedValue ? 0 : -90))
                Text(title).font(.body).foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)

            Spacer()
            if let trailingAction {
                Button(action: trailingAction) {
                    Image(systemName: "plus").foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("New channel")
            }
        }
        .frame(height: 34)
    }

    private func row(_ chat: ChatPresentation) -> some View {
        Button { onSelectChat(chat) } label: {
            HStack(spacing: 10) {
                chatIcon(chat)
                Text(chat.title)
                    .fontWeight(chat.unreadCount > 0 ? .semibold : .regular)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .frame(height: 42)
            .background(
                selectedChatID == chat.id ? Color.primary.opacity(0.045) : .clear,
                in: .capsule
            )
            .overlay(alignment: .leading) {
                if chat.unreadCount > 0 {
                    Capsule()
                        .fill(.primary)
                        .frame(width: 7, height: 14)
                        .offset(x: -23)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(chat.unreadCount > 0 ? "\(chat.title), unread" : chat.title)
    }

    @ViewBuilder
    private func chatIcon(_ chat: ChatPresentation) -> some View {
        switch chat.kind {
        case .channel:
            Image(systemName: "number").font(.title3)
                .frame(width: 26, height: 26)
        case .directMessage(let agent):
            AvatarView(name: agent.name, url: agent.avatarURL, presence: agent.presence, size: 28)
        }
    }
}

#Preview {
    ChatSidebarView(
        server: ChatFixtures.server,
        chats: ChatFixtures.chats,
        selectedChatID: "product",
        onSelectChat: { _ in },
        onOpenSettings: {}
    )
    .frame(width: 330)
}
