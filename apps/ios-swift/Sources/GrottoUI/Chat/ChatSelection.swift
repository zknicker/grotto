import Foundation

/// Which Chat the shell is showing. The App layer owns the value so the open
/// Chat, the rendered canvas, and Server read acknowledgements never disagree.
public enum ChatSelection {
    /// Keeps a selection that still exists, and otherwise falls forward to the
    /// first Chat so a removed or archived id cannot linger as a stale value.
    public static func resolve(selectedID: String?, chatIDs: [String]) -> String? {
        if let selectedID, chatIDs.contains(selectedID) {
            return selectedID
        }
        return chatIDs.first
    }

    /// A Chat the shell asked for before the Server list carried it — a created
    /// or restored channel. Returns the id only once the directory has it, so
    /// the request survives the round trip instead of selecting a missing Chat.
    public static func resolvePending(pendingID: String?, chatIDs: [String]) -> String? {
        guard let pendingID, chatIDs.contains(pendingID) else { return nil }
        return pendingID
    }
}

/// Which Chat the shell canvas is responsible for opening on the Server.
///
/// A pushed route — a Thread or the Tasks list — covers the canvas and owns the
/// open Chat while it is on screen, so the canvas stands down entirely rather
/// than loading and acknowledging reads for a Chat nobody is looking at. When
/// the stack empties the canvas is the visible surface again and re-opens
/// whatever it is showing.
public enum ChatCanvasOpen {
    public static func chatID(selectedID: ChatDestination.ID?, isCovered: Bool) -> String? {
        guard !isCovered, case .chat(let chatID) = selectedID else { return nil }
        return chatID
    }
}

/// A request to reveal one message inside a Chat. The Chat id travels with the
/// message id so a request cannot land on whichever Chat happens to be open.
public struct MessageScrollTarget: Hashable, Sendable {
    public let chatID: String
    public let messageID: String

    public init(chatID: String, messageID: String) {
        self.chatID = chatID
        self.messageID = messageID
    }
}
