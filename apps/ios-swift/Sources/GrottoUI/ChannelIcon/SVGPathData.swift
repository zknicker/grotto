import CoreGraphics
import Foundation
import SwiftUI

/// Parses SVG path data into a SwiftUI `Path`.
///
/// The bundled channel icon catalog is generated from hugeicons' React element
/// arrays, so this only ever has to understand path data — not a whole SVG
/// document. It implements the full command set anyway (absolute and relative
/// move, line, horizontal, vertical, cubic, smooth cubic, quadratic, smooth
/// quadratic, arc, and close) so a future catalog regeneration cannot silently
/// drop geometry.
///
/// SVG and SwiftUI share a y-down coordinate system, so coordinates pass
/// through unchanged.
public enum SVGPathData {
    /// Returns the geometry described by `data`. Unparseable input yields
    /// whatever was read before the failure, which is what the renderer wants:
    /// a partial glyph is still better than a crash, and the caller's hash
    /// fallback covers an entirely empty result.
    public static func path(from data: String) -> Path {
        var scanner = SVGPathScanner(data)
        var path = Path()
        var current = CGPoint.zero
        var subpathStart = CGPoint.zero
        var lastCubicControl: CGPoint?
        var lastQuadControl: CGPoint?
        var command: UInt8 = 0

        while true {
            let explicit = scanner.nextCommand()
            if let explicit {
                command = explicit
            } else if command == 0 || !scanner.hasNumber {
                break
            } else if command == UInt8(ascii: "M") {
                command = UInt8(ascii: "L")
            } else if command == UInt8(ascii: "m") {
                command = UInt8(ascii: "l")
            } else if command | 0x20 == UInt8(ascii: "z") {
                // Close consumes nothing, so a repeat would spin forever. Bare
                // numbers after a close are malformed anyway.
                return path
            }

            let relative = command >= UInt8(ascii: "a")
            let origin = relative ? current : .zero

            switch command | 0x20 {
            case UInt8(ascii: "m"):
                guard let point = scanner.nextPoint(origin) else { return path }
                path.move(to: point)
                current = point
                subpathStart = point
                lastCubicControl = nil
                lastQuadControl = nil
            case UInt8(ascii: "l"):
                guard let point = scanner.nextPoint(origin) else { return path }
                path.addLine(to: point)
                current = point
                lastCubicControl = nil
                lastQuadControl = nil
            case UInt8(ascii: "h"):
                guard let x = scanner.nextNumber() else { return path }
                current = CGPoint(x: origin.x + x, y: current.y)
                path.addLine(to: current)
                lastCubicControl = nil
                lastQuadControl = nil
            case UInt8(ascii: "v"):
                guard let y = scanner.nextNumber() else { return path }
                current = CGPoint(x: current.x, y: origin.y + y)
                path.addLine(to: current)
                lastCubicControl = nil
                lastQuadControl = nil
            case UInt8(ascii: "c"):
                guard let control1 = scanner.nextPoint(origin),
                      let control2 = scanner.nextPoint(origin),
                      let end = scanner.nextPoint(origin) else { return path }
                path.addCurve(to: end, control1: control1, control2: control2)
                current = end
                lastCubicControl = control2
                lastQuadControl = nil
            case UInt8(ascii: "s"):
                guard let control2 = scanner.nextPoint(origin),
                      let end = scanner.nextPoint(origin) else { return path }
                let control1 = reflect(lastCubicControl, around: current)
                path.addCurve(to: end, control1: control1, control2: control2)
                current = end
                lastCubicControl = control2
                lastQuadControl = nil
            case UInt8(ascii: "q"):
                guard let control = scanner.nextPoint(origin),
                      let end = scanner.nextPoint(origin) else { return path }
                path.addQuadCurve(to: end, control: control)
                current = end
                lastQuadControl = control
                lastCubicControl = nil
            case UInt8(ascii: "t"):
                guard let end = scanner.nextPoint(origin) else { return path }
                let control = reflect(lastQuadControl, around: current)
                path.addQuadCurve(to: end, control: control)
                current = end
                lastQuadControl = control
                lastCubicControl = nil
            case UInt8(ascii: "a"):
                guard let radiusX = scanner.nextNumber(),
                      let radiusY = scanner.nextNumber(),
                      let rotation = scanner.nextNumber(),
                      let largeArc = scanner.nextFlag(),
                      let sweep = scanner.nextFlag(),
                      let end = scanner.nextPoint(origin) else { return path }
                appendArc(
                    to: &path,
                    from: current,
                    to: end,
                    radiusX: radiusX,
                    radiusY: radiusY,
                    rotationDegrees: rotation,
                    largeArc: largeArc,
                    sweep: sweep
                )
                current = end
                lastCubicControl = nil
                lastQuadControl = nil
            case UInt8(ascii: "z"):
                path.closeSubpath()
                current = subpathStart
                lastCubicControl = nil
                lastQuadControl = nil
            default:
                return path
            }
        }

        return path
    }

    private static func reflect(_ control: CGPoint?, around current: CGPoint) -> CGPoint {
        guard let control else { return current }
        return CGPoint(x: 2 * current.x - control.x, y: 2 * current.y - control.y)
    }
}

// MARK: - Arcs

/// Converts one SVG endpoint-parameterized arc into cubic segments, following
/// the implementation notes in the SVG 1.1 specification (F.6.5).
private func appendArc(
    to path: inout Path,
    from start: CGPoint,
    to end: CGPoint,
    radiusX: CGFloat,
    radiusY: CGFloat,
    rotationDegrees: CGFloat,
    largeArc: Bool,
    sweep: Bool
) {
    guard start != end else { return }
    var radiusX = abs(radiusX)
    var radiusY = abs(radiusY)
    guard radiusX > 0, radiusY > 0 else {
        path.addLine(to: end)
        return
    }

    let phi = rotationDegrees * .pi / 180
    let cosPhi = cos(phi)
    let sinPhi = sin(phi)
    let dx = (start.x - end.x) / 2
    let dy = (start.y - end.y) / 2
    let x1 = cosPhi * dx + sinPhi * dy
    let y1 = -sinPhi * dx + cosPhi * dy

    // Radii too small to span the endpoints are scaled up rather than rejected.
    let lambda = (x1 * x1) / (radiusX * radiusX) + (y1 * y1) / (radiusY * radiusY)
    if lambda > 1 {
        let correction = sqrt(lambda)
        radiusX *= correction
        radiusY *= correction
    }

    let numerator = max(
        0,
        radiusX * radiusX * radiusY * radiusY
            - radiusX * radiusX * y1 * y1
            - radiusY * radiusY * x1 * x1
    )
    let denominator = radiusX * radiusX * y1 * y1 + radiusY * radiusY * x1 * x1
    let coefficient = (largeArc == sweep ? -1 : 1) * sqrt(denominator == 0 ? 0 : numerator / denominator)
    let cx1 = coefficient * radiusX * y1 / radiusY
    let cy1 = -coefficient * radiusY * x1 / radiusX
    let center = CGPoint(
        x: cosPhi * cx1 - sinPhi * cy1 + (start.x + end.x) / 2,
        y: sinPhi * cx1 + cosPhi * cy1 + (start.y + end.y) / 2
    )

    let startAngle = angle(
        from: CGPoint(x: 1, y: 0),
        to: CGPoint(x: (x1 - cx1) / radiusX, y: (y1 - cy1) / radiusY)
    )
    var sweepAngle = angle(
        from: CGPoint(x: (x1 - cx1) / radiusX, y: (y1 - cy1) / radiusY),
        to: CGPoint(x: (-x1 - cx1) / radiusX, y: (-y1 - cy1) / radiusY)
    )
    if !sweep, sweepAngle > 0 {
        sweepAngle -= 2 * .pi
    } else if sweep, sweepAngle < 0 {
        sweepAngle += 2 * .pi
    }

    let segments = max(1, Int(ceil(abs(sweepAngle) / (.pi / 2))))
    let step = sweepAngle / CGFloat(segments)
    let alpha = 4.0 / 3.0 * tan(step / 4)

    for segment in 0..<segments {
        let theta1 = startAngle + CGFloat(segment) * step
        let theta2 = theta1 + step
        let point1 = arcPoint(center, radiusX, radiusY, cosPhi, sinPhi, theta1)
        let point2 = arcPoint(center, radiusX, radiusY, cosPhi, sinPhi, theta2)
        let slope1 = arcSlope(radiusX, radiusY, cosPhi, sinPhi, theta1)
        let slope2 = arcSlope(radiusX, radiusY, cosPhi, sinPhi, theta2)
        path.addCurve(
            to: point2,
            control1: CGPoint(x: point1.x + alpha * slope1.x, y: point1.y + alpha * slope1.y),
            control2: CGPoint(x: point2.x - alpha * slope2.x, y: point2.y - alpha * slope2.y)
        )
    }
}

private func arcPoint(
    _ center: CGPoint,
    _ radiusX: CGFloat,
    _ radiusY: CGFloat,
    _ cosPhi: CGFloat,
    _ sinPhi: CGFloat,
    _ theta: CGFloat
) -> CGPoint {
    CGPoint(
        x: center.x + radiusX * cosPhi * cos(theta) - radiusY * sinPhi * sin(theta),
        y: center.y + radiusX * sinPhi * cos(theta) + radiusY * cosPhi * sin(theta)
    )
}

private func arcSlope(
    _ radiusX: CGFloat,
    _ radiusY: CGFloat,
    _ cosPhi: CGFloat,
    _ sinPhi: CGFloat,
    _ theta: CGFloat
) -> CGPoint {
    CGPoint(
        x: -radiusX * cosPhi * sin(theta) - radiusY * sinPhi * cos(theta),
        y: -radiusX * sinPhi * sin(theta) + radiusY * cosPhi * cos(theta)
    )
}

private func angle(from lhs: CGPoint, to rhs: CGPoint) -> CGFloat {
    let magnitude = sqrt((lhs.x * lhs.x + lhs.y * lhs.y) * (rhs.x * rhs.x + rhs.y * rhs.y))
    guard magnitude > 0 else { return 0 }
    let cosine = min(1, max(-1, (lhs.x * rhs.x + lhs.y * rhs.y) / magnitude))
    return (lhs.x * rhs.y - lhs.y * rhs.x < 0 ? -1 : 1) * acos(cosine)
}
