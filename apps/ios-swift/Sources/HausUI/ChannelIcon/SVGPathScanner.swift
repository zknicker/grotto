import CoreGraphics
import Foundation

/// Byte-level tokenizer for SVG path data.
///
/// Path data separates numbers with whitespace, commas, or nothing at all —
/// `M1-2.5.75` is three numbers — so the scanner has to find number boundaries
/// itself rather than splitting on separators.
struct SVGPathScanner {
    private let bytes: [UInt8]
    private var index = 0

    init(_ data: String) {
        bytes = Array(data.utf8)
    }

    /// True when the next token is a number rather than a command letter, which
    /// is how the parser knows an implicit command repeat is coming.
    var hasNumber: Bool {
        var probe = self
        probe.skipSeparators()
        guard probe.index < probe.bytes.count else { return false }
        return probe.isNumberStart(probe.bytes[probe.index])
    }

    /// The next command letter, or nil when a number comes first.
    mutating func nextCommand() -> UInt8? {
        skipSeparators()
        guard index < bytes.count else { return nil }
        let byte = bytes[index]
        guard (byte | 0x20) >= UInt8(ascii: "a"), (byte | 0x20) <= UInt8(ascii: "z") else {
            return nil
        }
        index += 1
        return byte
    }

    mutating func nextPoint(_ origin: CGPoint) -> CGPoint? {
        guard let x = nextNumber(), let y = nextNumber() else { return nil }
        return CGPoint(x: origin.x + x, y: origin.y + y)
    }

    /// Arc flags are single digits and may be packed against the next number
    /// without a separator, so they are read one byte at a time.
    mutating func nextFlag() -> Bool? {
        skipSeparators()
        guard index < bytes.count else { return nil }
        switch bytes[index] {
        case UInt8(ascii: "0"):
            index += 1
            return false
        case UInt8(ascii: "1"):
            index += 1
            return true
        default:
            return nil
        }
    }

    mutating func nextNumber() -> CGFloat? {
        skipSeparators()
        let start = index
        if index < bytes.count, bytes[index] == UInt8(ascii: "+") || bytes[index] == UInt8(ascii: "-") {
            index += 1
        }
        var digits = false
        while index < bytes.count, isDigit(bytes[index]) {
            index += 1
            digits = true
        }
        if index < bytes.count, bytes[index] == UInt8(ascii: ".") {
            index += 1
            while index < bytes.count, isDigit(bytes[index]) {
                index += 1
                digits = true
            }
        }
        guard digits else {
            index = start
            return nil
        }
        if index < bytes.count, bytes[index] | 0x20 == UInt8(ascii: "e") {
            let exponentStart = index
            index += 1
            if index < bytes.count,
               bytes[index] == UInt8(ascii: "+") || bytes[index] == UInt8(ascii: "-") {
                index += 1
            }
            var exponentDigits = false
            while index < bytes.count, isDigit(bytes[index]) {
                index += 1
                exponentDigits = true
            }
            if !exponentDigits {
                index = exponentStart
            }
        }

        let text = String(decoding: bytes[start..<index], as: UTF8.self)
        guard let value = Double(text) else {
            index = start
            return nil
        }
        return CGFloat(value)
    }

    private mutating func skipSeparators() {
        while index < bytes.count {
            let byte = bytes[index]
            guard byte == UInt8(ascii: " ") || byte == UInt8(ascii: ",")
                || byte == UInt8(ascii: "\n") || byte == UInt8(ascii: "\r")
                || byte == UInt8(ascii: "\t") else { return }
            index += 1
        }
    }

    private func isDigit(_ byte: UInt8) -> Bool {
        byte >= UInt8(ascii: "0") && byte <= UInt8(ascii: "9")
    }

    private func isNumberStart(_ byte: UInt8) -> Bool {
        isDigit(byte) || byte == UInt8(ascii: "-") || byte == UInt8(ascii: "+")
            || byte == UInt8(ascii: ".")
    }
}
