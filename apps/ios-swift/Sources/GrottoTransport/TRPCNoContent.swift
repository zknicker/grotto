import Foundation

/// Marker for successful tRPC procedures whose handler returns `undefined`.
///
/// tRPC 11 emits `{"result":{}}` for that response, so this is intentionally
/// distinct from a JSON object or a nullable domain value.
public struct TRPCNoContent: Decodable, Equatable, Sendable {
    public init() {}

    public init(from decoder: Decoder) throws {
        if let container = try? decoder.singleValueContainer(), container.decodeNil() {
            return
        }

        // A missing `data` key never invokes this initializer; accepting an
        // empty keyed value also keeps the marker useful for direct fixtures.
        if let container = try? decoder.container(keyedBy: AnyCodingKey.self), container.allKeys.isEmpty {
            return
        }

        throw DecodingError.typeMismatch(
            Self.self,
            DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Expected a null or empty tRPC result.")
        )
    }
}

private struct AnyCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init?(stringValue: String) {
        self.stringValue = stringValue
        intValue = nil
    }

    init?(intValue: Int) {
        stringValue = String(intValue)
        self.intValue = intValue
    }
}
