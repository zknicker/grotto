import SwiftUI

public struct ChatSidebarView: View {
    /// Real (non-safe-area-bleed) space reserved below the visible content so
    /// the floating gear button's shadow has room to render. `GrottoShellView`
    /// composites this view with `.mask()`, which rasterizes into an offscreen
    /// buffer sized to this view's own resolved height — `.ignoresSafeArea()`
    /// bleed does not survive that, so the extra room has to come from actual
    /// layout height (see `GrottoShellView`'s matching `+ shadowBleedHeight`).
    static let shadowBleedHeight: CGFloat = 32

    private let server: ServerPresentation
    private let chats: [ChatPresentation]
    private let selectedChatID: String?
    private let onSelectChat: (ChatPresentation) -> Void
    private let onOpenSettings: () -> Void
    private let onOpenSearch: () -> Void
    private let onOpenTasks: () -> Void
    private let onOpenArchived: () -> Void
    private let onOpenNewChannel: () -> Void

    @State private var channelsExpanded = true
    @State private var directMessagesExpanded = true
    @Environment(\.colorScheme) private var colorScheme

    public init(
        server: ServerPresentation,
        chats: [ChatPresentation],
        selectedChatID: String?,
        onSelectChat: @escaping (ChatPresentation) -> Void,
        onOpenSettings: @escaping () -> Void,
        onOpenSearch: @escaping () -> Void = {},
        onOpenTasks: @escaping () -> Void = {},
        onOpenArchived: @escaping () -> Void = {},
        onOpenNewChannel: @escaping () -> Void = {}
    ) {
        self.server = server
        self.chats = chats
        self.selectedChatID = selectedChatID
        self.onSelectChat = onSelectChat
        self.onOpenSettings = onOpenSettings
        self.onOpenSearch = onOpenSearch
        self.onOpenTasks = onOpenTasks
        self.onOpenArchived = onOpenArchived
        self.onOpenNewChannel = onOpenNewChannel
    }

    public var body: some View {
        // The trailing `Color.clear` reserves real bottom space (not a
        // safe-area bleed hint) for the gear button's shadow — see
        // `shadowBleedHeight`. It doesn't move the button: `GrottoShellView`
        // grows this view's proposed height by the same amount, so the
        // ZStack below still resolves to its original height.
        VStack(spacing: 0) {
            ZStack(alignment: .bottomTrailing) {
                VStack(alignment: .leading, spacing: 14) {
                    ChromeHeader(inset: 20, leading: {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(server.name).font(.title3.weight(.semibold))
                            Text(serverCounts)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }) {
                        GlassChromeButton(.symbol("magnifyingglass"), label: "Search", action: onOpenSearch)
                    }

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

                            sectionHeader("DMs", isExpanded: $directMessagesExpanded)
                                .padding(.top, 6)
                            if directMessagesExpanded {
                                ForEach(directMessages) { row($0) }
                            }

                            utilityRow("Tasks", systemImage: "checklist", action: onOpenTasks)
                                .padding(.top, 6)
                            utilityRow("Archived", systemImage: "archivebox", action: onOpenArchived)
                        }
                        .padding(.bottom, 72)
                    }
                    .scrollIndicators(.hidden)
                    .padding(.horizontal, 20)
                }

                GlassChromeButton(.symbol("gearshape"), label: "Settings", action: onOpenSettings)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
            }

            Color.clear
                .frame(height: Self.shadowBleedHeight)
                .allowsHitTesting(false)
        }
        .background(GrottoPlatformColor.background)
    }

    private func utilityRow(
        _ title: String,
        systemImage: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .foregroundStyle(.primary)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, minHeight: 42, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
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

    /// Dark mode reads `Color.primary.opacity` too faintly against a near-black
    /// background, so the selected row needs more presence there than light
    /// mode needs.
    private var selectedRowFill: Color {
        colorScheme == .dark ? Color.primary.opacity(0.12) : Color.primary.opacity(0.045)
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
                selectedChatID == chat.id ? selectedRowFill : .clear,
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
