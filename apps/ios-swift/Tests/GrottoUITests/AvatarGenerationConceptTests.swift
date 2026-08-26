import Testing
@testable import GrottoUI

@Suite("Avatar generation concept")
struct AvatarGenerationConceptTests {
    @Test("requires a nonblank concept")
    func rejectsBlankConcepts() {
        #expect(AvatarGenerationConcept.validationError(for: " \n ") != nil)
    }

    @Test("trims the concept sent to the Server")
    func normalizesConcept() {
        #expect(
            AvatarGenerationConcept.normalized("  a moonlit fox cartographer \n")
                == "a moonlit fox cartographer"
        )
    }

    @Test("matches the Server's 280-character limit")
    func enforcesMaximumLength() {
        #expect(AvatarGenerationConcept.validationError(for: String(repeating: "a", count: 280)) == nil)
        #expect(
            AvatarGenerationConcept.validationError(for: String(repeating: "a", count: 281))
                == "Keep the concept to 280 characters or fewer."
        )
    }
}
