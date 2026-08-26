import Foundation

/// JSON coding configured for Grotto's ISO-8601 timestamps.
///
/// Server timestamps include an explicit offset and may include fractional
/// seconds. Callers should use these factories instead of Foundation's plain
/// `.iso8601` strategy, which does not accept every timestamp emitted by the
/// Server.
public enum GrottoJSON {
    public static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            guard let date = GrottoISO8601.date(from: value) else {
                throw DecodingError.dataCorruptedError(
                    in: container,
                    debugDescription: "Expected a Grotto ISO-8601 timestamp."
                )
            }
            return date
        }
        return decoder
    }

    public static func encoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(GrottoISO8601.string(from: date))
        }
        return encoder
    }
}

public enum GrottoISO8601 {
    // ISO8601DateFormatter is documented thread-safe; constructing one per
    // timestamp dominated page-decode cost, so these are shared.
    // nonisolated(unsafe) because the class predates Sendable; it is never
    // mutated after construction.
    nonisolated(unsafe) private static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    nonisolated(unsafe) private static let standard: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    nonisolated(unsafe) private static let output: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    public static func date(from value: String) -> Date? {
        fractional.date(from: value) ?? standard.date(from: value)
    }

    public static func string(from date: Date) -> String {
        output.string(from: date)
    }
}
