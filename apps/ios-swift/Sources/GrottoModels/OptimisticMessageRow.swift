/// The identity and the lifetime of an optimistic Chat row.
///
/// A row the viewer just sent has to survive two handoffs without the
/// transcript noticing: Server names the message, and then the refreshed page
/// carries it. Both decisions live here so the Store's bookkeeping and the
/// projection that renders the row cannot disagree about which row is on
/// screen.
public enum OptimisticMessageRow {
    /// Local key for a row Server has not named yet. Server message ids never
    /// carry this prefix, so the two id spaces cannot collide.
    public static let localIDPrefix = "pending:"

    /// The row's identity in the transcript.
    ///
    /// Before the send receipt lands there is no canonical id, so the row is
    /// keyed by its own nonce. The moment the receipt names the message the row
    /// adopts that id — the durable row that replaces it carries the same one,
    /// so the swap is an in-place update rather than a `ForEach` identity
    /// change that drops the row and inserts a new one.
    public static func id(nonce: String, serverMessageID: String?) -> String {
        serverMessageID ?? "\(localIDPrefix)\(nonce)"
    }

    /// Nonces the durable page already accounts for.
    public static func durableNonces(in messages: [ChatMessage]) -> Set<String> {
        Set(messages.map(\.nonce))
    }

    /// Whether the canonical row is on screen, which is exactly when the
    /// optimistic row has to stop being projected. Both rows carry the same id
    /// once the receipt has landed, so this is what keeps the transcript from
    /// ever showing the pair.
    public static func isSuperseded(nonce: String, durableNonces: Set<String>) -> Bool {
        durableNonces.contains(nonce)
    }
}
