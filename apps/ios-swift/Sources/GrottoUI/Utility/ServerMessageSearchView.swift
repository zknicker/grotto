import Foundation
import SwiftUI

/// A presentation-only search result. The App adapter resolves the Server's
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

    fileprivate var systemImage: String {
        switch self {
        case .channel: "number"
        case .directMessage: "bubble.left"
        }
    }
}

/// Native message search. Search work is injected so the view stays independent
/// from tRPC, authentication, and the App's cache policy.
public struct ServerMessageSearchView: View {
    @Environment(\.dismiss) private var dismiss

    private let search: @Sendable (String) async throws -> [MessageSearchResultPresentation]
    private let onSelectResult: (MessageSearchResultPresentation) -> Void

    @State private var query: String
    @State private var results: [MessageSearchResultPresentation] = []
    @State private var hasSearched = false
    @State private var isSearching = false
    @State private var searchError: String?
    @State private var retryToken = 0

    public init(
        initialQuery: String = "",
        search: @escaping @Sendable (String) async throws -> [MessageSearchResultPresentation],
        onSelectResult: @escaping (MessageSearchResultPresentation) -> Void
    ) {
        self.search = search
        self.onSelectResult = onSelectResult
        _query = State(initialValue: initialQuery)
    }

    public var body: some View {
        NavigationStack {
            content
                .navigationTitle("Search messages")
                .grottoInlineNavigationTitle()
                .searchable(text: $query, prompt: "Search messages")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            dismiss()
                        }
                    }
                }
        }
        .task(id: "\(query)|\(retryToken)") {
            await runSearch(for: query)
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(GrottoPlatformColor.groupedBackground)
    }

    @ViewBuilder
    private var content: some View {
        if results.isEmpty, let searchError {
            ContentUnavailableView {
                Label("Search unavailable", systemImage: "exclamationmark.triangle")
            } description: {
                Text(searchError)
            } actions: {
                Button("Try again") {
                    retryToken += 1
                }
                .buttonStyle(.borderedProminent)
            }
        } else if results.isEmpty {
            ZStack(alignment: .top) {
                if hasSearched {
                    ContentUnavailableView(
                        "No messages found",
                        systemImage: "text.magnifyingglass",
                        description: Text("Try a different phrase or search term.")
                    )
                } else {
                    ContentUnavailableView(
                        "Search Grotto",
                        systemImage: "magnifyingglass",
                        description: Text("Search messages across your channels and Agent DMs.")
                    )
                }
                searchProgress
            }
        } else {
            ZStack(alignment: .top) {
                List(results) { result in
                    Button {
                        onSelectResult(result)
                    } label: {
                        MessageSearchResultRow(result: result)
                    }
                    .buttonStyle(.plain)
                    .listRowInsets(.init(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowSeparator(.hidden)
                }
                .listStyle(.plain)
                searchProgress
                if let searchError {
                    HStack(spacing: 8) {
                        Label("Search unavailable", systemImage: "exclamationmark.triangle")
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        Button("Retry") {
                            retryToken += 1
                        }
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
                    .accessibilityLabel("Search unavailable: \(searchError)")
                }
            }
        }
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

    private func runSearch(for rawQuery: String) async {
        let term = rawQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !term.isEmpty else {
            results = []
            hasSearched = false
            isSearching = false
            searchError = nil
            return
        }

        // Keep the current result set on screen while the user is still
        // composing a new query. Only show progress after the debounce, so
        // keyboard input never causes a full-screen loading flash.
        isSearching = false
        hasSearched = false
        searchError = nil
        do {
            try await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            isSearching = true
            let results = try await search(term)
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

private struct MessageSearchResultRow: View {
    let result: MessageSearchResultPresentation

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            AvatarView(name: result.authorName, url: result.authorAvatarURL, size: 36)

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(result.authorName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text("in")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Label {
                        Text(result.chatName)
                            .lineLimit(1)
                    } icon: {
                        Image(systemName: result.chatKind.systemImage)
                    }
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                    Spacer(minLength: 4)
                    Text(result.createdAt, format: .dateTime.month(.abbreviated).day().hour().minute())
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }

                Text(result.content)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(result.authorName) in \(result.chatName): \(result.content)")
    }
}

private enum MessageSearchPreviewFixtures {
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
        MessageSearchResultPresentation(
            id: "search-3",
            authorName: "Cove",
            chatID: "chat-cove",
            chatKind: .directMessage,
            chatName: "Cove",
            content: "I am online and ready to help.",
            createdAt: .now.addingTimeInterval(-7_200)
        ),
    ]
}

#Preview("Search results") {
    ServerMessageSearchView(search: { _ in MessageSearchPreviewFixtures.results }) { _ in }
}

#Preview("Search empty") {
    ServerMessageSearchView(search: { _ in [] }) { _ in }
}

#Preview("Search error") {
    ServerMessageSearchView(search: { _ in
        struct PreviewError: LocalizedError {
            var errorDescription: String? { "The Server could not be reached." }
        }
        throw PreviewError()
    }) { _ in }
}
