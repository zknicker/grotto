import Foundation

/// The one brief the Server accepts, and the rules the field enforces before a
/// request is worth sending. These mirror `avatarGenerationConceptMaxLength` in
/// the shared Grotto API contract.
enum AvatarGenerationConcept {
    static let maxLength = 280
    /// Below this the counter is noise; past it the ceiling is worth watching.
    static let counterThreshold = 200

    static func normalized(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func validationError(for value: String) -> String? {
        let concept = normalized(value)
        if concept.isEmpty {
            return "Enter a short concept before generating an avatar."
        }
        if concept.count > maxLength {
            return "Keep the concept to 280 characters or fewer."
        }
        return nil
    }
}
