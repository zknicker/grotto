import Foundation

public struct ServerSentEvent: Equatable, Sendable {
    public let event: String?
    public let data: String
    public let id: String?
    public let retryMilliseconds: Int?

    public init(
        event: String?,
        data: String,
        id: String?,
        retryMilliseconds: Int?
    ) {
        self.event = event
        self.data = data
        self.id = id
        self.retryMilliseconds = retryMilliseconds
    }
}

/// Incremental parser for the HTML Server-Sent Events wire format.
///
/// `URLSession.AsyncBytes.lines` provides one logical line at a time. The
/// parser intentionally owns event framing so comments, multiline data, and
/// fields arriving in any order are handled consistently.
public struct SSEParser: Sendable {
    private var eventName: String?
    private var dataLines: [String] = []
    private var eventId: String?
    private var lastEventId: String?
    private var retryMilliseconds: Int?

    public init() {}

    /// Consumes one line without its line terminator. A blank line dispatches
    /// the accumulated event; all other lines return `nil`.
    public mutating func consume(line: String) -> ServerSentEvent? {
        let line = line.hasSuffix("\r") ? String(line.dropLast()) : line
        guard !line.isEmpty else {
            return dispatch()
        }

        if line.first == ":" {
            return nil
        }

        let separator = line.firstIndex(of: ":")
        let field: String
        let value: String
        if let separator {
            field = String(line[..<separator])
            let valueStart = line.index(after: separator)
            let rawValue = line[valueStart...]
            value = rawValue.first == " " ? String(rawValue.dropFirst()) : String(rawValue)
        } else {
            field = line
            value = ""
        }

        switch field {
        case "event":
            eventName = value
        case "data":
            dataLines.append(value)
        case "id":
            // The SSE spec ignores an id containing a NUL character.
            if !value.contains("\0") {
                eventId = value
            }
        case "retry":
            if let retry = Int(value), retry >= 0 {
                retryMilliseconds = retry
            }
        default:
            break
        }
        return nil
    }

    /// Dispatches an unterminated final event, if it contains data or fields.
    public mutating func finish() -> ServerSentEvent? {
        dispatch()
    }

    private mutating func dispatch() -> ServerSentEvent? {
        guard !dataLines.isEmpty else {
            // Event fields are reset at dispatch even when the data buffer is
            // empty; the SSE spec does not emit an event for an id-only frame.
            eventName = nil
            eventId = nil
            return nil
        }

        let event = ServerSentEvent(
            event: eventName,
            data: dataLines.joined(separator: "\n"),
            id: eventId ?? lastEventId,
            retryMilliseconds: retryMilliseconds
        )
        if let eventId {
            lastEventId = eventId
        }
        eventName = nil
        dataLines.removeAll(keepingCapacity: true)
        eventId = nil
        return event
    }
}
