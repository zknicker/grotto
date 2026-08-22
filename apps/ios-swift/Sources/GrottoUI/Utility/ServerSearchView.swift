import Foundation
import SwiftUI

/// A presentation-only message result. The App adapter resolves the Server's
/// message author and chat ids into this display-ready shape before handing it
/// to the view.
public struct MessageSearchResultPresentation: Identifiable, Hashable, Sendable {
    public let id: String
    public let authorName: String
    public let authorAvatarURL: URL?
    public let chatID: String
    public let chatKind: MessageSearchChatKind
    public let chatName: String
    public let content: String
    public let createdAt: Date

    public init(
        id: String,
        authorName: String,
        authorAvatarURL: URL? = nil,
        chatID: String,
        chatKind: MessageSearchChatKind = .channel,
        chatName: String,
        content: String,
        createdAt: Date
    ) {
        self.id = id
        self.authorName = authorName
        self.authorAvatarURL = authorAvatarURL
        self.chatID = chatID
        self.chatKind = chatKind
        self.chatName = chatName
        self.content = content
        self.createdAt = createdAt
    }
}

public enum MessageSearchChatKind: Hashable, Sendable {
    case channel
    case directMessage
}

/// Chat-name matching for the search surface.
enum ServerSearch {
    /// Chats whose name matches the query, with prefix matches first.
    static func matchingChats(_ chats: [ChatPresentation], query: String) -> [ChatPresentation] {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !term.isEmpty else { return [] }

        let matches = chats.filter {
            $0.title.range(of: term, options: [.caseInsensitive, .diacriticInsensitive]) != nil
        }
        return matches.sorted { lhs, rhs in
            hasPrefix(lhs, term) && !hasPrefix(rhs, term)
        }
    }

    private static func hasPrefix(_ chat: ChatPresentation, _ term: String) -> Bool {
        chat.title.range(
            of: term,
            options: [.caseInsensitive, .diacriticInsensitive, .anchored]
        ) != nil
    }
}

/// One search surface for the active Server: chats resolve locally from the
/// Store cache while messages resolve through the Server. Search work is
/// injected so the view stays independent from tRPC, authentication, and the
/// App's cache policy.
struct ServerSearchView: View {
    @Environment(\.dismiss) private var dismiss

    private let chats: [ChatPresentation]
    private let searchMessages: @Sendable (String) async throws -> [MessageSearchResultPresentation]
    private let onSelectChat: (ChatPresentation) -> Void
    /// Returns `false` when the result's Chat is no longer in the directory, so
    /// the sheet can report the failure instead of dismissing into nothing.
    private let onSelectMessage: (MessageSearchResultPresentation) -> Bool

    @State private var query = ""
    @State private var selectionError: String?
    @State private var results: [MessageSearchResultPresentation] = []
    @State private var hasSearched = false
    @State private var isSearching = false
    @State private var searchError: String?
    @State private var retryToken = 0

    init(
        chats: [ChatPresentation],
        searchMessages: @escaping @Sendable (String) async throws -> [MessageSearchResultPresentation],
        onSelectChat: @escaping (ChatPresentation) -> Void,
        onSelectMessage: @escaping (MessageSearchResultPresentation) -> Bool
    ) {
        self.chats = chats
        self.searchMessages = searchMessages
        self.onSelectChat = onSelectChat
        self.onSelectMessage = onSelectMessage
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Search")
                .grottoInlineNavigationTitle()
                .searchable(text: $query, prompt: "Channels, Agents, and messages")
#if os(iOS)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
#endif
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                }
                .alert("Couldn’t open that chat", isPresented: hasSelectionError) {
                    Button("OK") { selectionError = nil }
                } message: {
                    Text(selectionError ?? "Try again.")
                }
        }
        .task(id: "\(query)|\(retryToken)") {
            await runSearch(for: query)
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(GrottoPlatformColor.groupedBackground)
    }

    private var hasSelectionError: Binding<Bool> {
        Binding(
            get: { selectionError != nil },
            set: { if !$0 { selectionError = nil } }
        )
    }

    private var chatMatches: [ChatPresentation] {
        ServerSearch.matchingChats(chats, query: query)
    }

    @ViewBuilder
    private var content: some View {
        if results.isEmpty, chatMatches.isEmpty, let searchError {
            ContentUnavailableView {
                Label("Search unavailable", systemImage: "exclamationmark.triangle")
            } description: {
                Text(searchError)
            } actions: {
                Button("Try again") { retryToken += 1 }
                    .buttonStyle(.borderedProminent)
            }
        } else if results.isEmpty, chatMatches.isEmpty {
            ZStack(alignment: .top) {
                if hasSearched {
                    ContentUnavailableView(
                        "No matches",
                        systemImage: "text.magnifyingglass",
                        description: Text("Try a channel, an Agent name, or a different phrase.")
                    )
                } else if query.isEmpty {
                    ContentUnavailableView(
                        "Search Grotto",
                        systemImage: "magnifyingglass",
                        description: Text("Find a channel or Agent, or a message anyone has sent.")
                    )
                }
                searchProgress
            }
        } else {
            ZStack(alignment: .top) {
                resultList
                searchProgress
                if let searchError {
                    searchErrorBanner(searchError)
                }
            }
        }
    }

    private var resultList: some View {
        List {
            if !chatMatches.isEmpty {
                Section("Chats") {
                    ForEach(chatMatches) { chat in
                        Button {
                            onSelectChat(chat)
                        } label: {
                            ChatSearchResultRow(chat: chat)
                        }
                        .buttonStyle(.plain)
                        .listRowInsets(searchRowInsets)
                    }
                }
            }

            if !results.isEmpty {
                Section("Messages") {
                    ForEach(results) { result in
                        Button {
                            guard onSelectMessage(result) else {
                                selectionError = "That message’s chat is no longer in this Server."
                                return
                            }
                        } label: {
                            MessageSearchResultRow(result: result)
                        }
                        .buttonStyle(.plain)
                        .listRowInsets(searchRowInsets)
                    }
                }
            }
        }
#if os(iOS)
        .listStyle(.insetGrouped)
#else
        .listStyle(.inset)
#endif
        .scrollContentBackground(.hidden)
        .background(GrottoPlatformColor.groupedBackground)
    }

    @ViewBuilder
    private var searchProgress: some View {
        if isSearching {
            ProgressView()
                .controlSize(.small)
                .padding(8)
                .background(.regularMaterial, in: .capsule)
                .accessibilityLabel("Searching")
                .padding(.top, 10)
        }
    }

    private func searchErrorBanner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Label("Messages unavailable", systemImage: "exclamationmark.triangle")
                .lineLimit(1)
            Spacer(minLength: 4)
            Button("Retry") { retryToken += 1 }
                .font(.caption.weight(.semibold))
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.regularMaterial, in: .capsule)
        .padding(.top, 10)
        .padding(.horizontal, 16)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Messages unavailable: \(message)")
    }

    private func runSearch(for rawQuery: String) async {
        let term = rawQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !term.isEmpty else {
            results = []
            hasSearched = false
            isSearching = false
            searchError = nil
            return
        }

        // Chat matches are already on screen. Keep the current message results
        // while the user is still composing, and only show progress after the
        // debounce, so keyboard input never causes a full-screen loading flash.
        isSearching = false
        hasSearched = false
        searchError = nil
        do {
            try await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            isSearching = true
            let results = try await searchMessages(term)
            guard !Task.isCancelled else { return }
            self.results = results
            hasSearched = true
            isSearching = false
            searchError = nil
        } catch is CancellationError {
            // A new keystroke cancels the previous search normally.
        } catch {
            guard !Task.isCancelled else { return }
            hasSearched = true
            isSearching = false
            searchError = error.localizedDescription
        }
    }
}

// Chat and message results share one row inset so a single-line chat row and a
// multi-line message row read as the same list rhythm.
private let searchRowInsets = EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16)

private struct ChatSearchResultRow: View {
    let chat: ChatPresentation

    var body: some View {
        HStack(spacing: 12) {
            switch chat.kind {
            case .channel:
                Image(systemName: "number")
                    .font(.title3)
                    .frame(width: 36, height: 36)
            case .directMessage(let agent):
                AvatarView(name: agent.name, url: agent.avatarURL, presence: agent.presence, size: 36)
            }

            Text(chat.title)
                .font(.body)
                .fontWeight(chat.unreadCount > 0 ? .semibold : .regular)
                .foregroundStyle(.primary)
                .lineLimit(1)

            Spacer(minLength: 8)

            if chat.unreadCount > 0 {
                Circle()
                    .fill(.primary)
                    .frame(width: 8, height: 8)
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(chat.unreadCount > 0 ? "\(chat.title), unread" : chat.title)
    }
}

private struct MessageSearchResultRow: View {
    let result: MessageSearchResultPresentation

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            AvatarView(name: result.authorName, url: result.authorAvatarURL, size: 36)

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(result.authorName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                        .layoutPriority(1)
                    Text(chatContextLabel)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text(GrottoCompactRelativeTime.label(for: result.createdAt))
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }

                Text(result.content)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(result.authorName) in \(result.chatName): \(result.content)")
    }

    private var chatContextLabel: String {
        switch result.chatKind {
        case .channel: "in #\(result.chatName)"
        case .directMessage: "in DM"
        }
    }
}

private enum ServerSearchPreviewFixtures {
    static let results = [
        MessageSearchResultPresentation(
            id: "search-1",
            authorName: "Cove",
            chatID: "chat-cove",
            chatName: "product",
            content: "The Server contract is already carrying the task and reply data we need.",
            createdAt: .now.addingTimeInterval(-900)
        ),
        MessageSearchResultPresentation(
            id: "search-2",
            authorName: "Zach Knickerbocker",
            chatID: "chat-product",
            chatName: "product",
            content: "Let's keep the native shell focused on the daily chat loop.",
            createdAt: .now.addingTimeInterval(-3_600)
        ),
    ]
}

#Preview("Search results") {
    ServerSearchView(
        chats: ChatFixtures.chats,
        searchMessages: { _ in ServerSearchPreviewFixtures.results },
        onSelectChat: { _ in },
        onSelectMessage: { _ in true }
    )
}

#Preview("Search error") {
    ServerSearchView(
        chats: ChatFixtures.chats,
        searchMessages: { _ in
            struct PreviewError: LocalizedError {
                var errorDescription: String? { "The Server could not be reached." }
            }
            throw PreviewError()
        },
        onSelectChat: { _ in },
        onSelectMessage: { _ in true }
    )
}
