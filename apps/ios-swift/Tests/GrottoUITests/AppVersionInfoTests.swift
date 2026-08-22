@testable import GrottoUI
import Testing

struct AppVersionInfoTests {
    @Test func combinesVersionAndBuild() {
        #expect(AppVersionInfo.formatted(shortVersion: "1.8.19", build: "123") == "1.8.19 (123)")
    }

    @Test func fallsBackToVersionAloneWithoutBuild() {
        #expect(AppVersionInfo.formatted(shortVersion: "1.8.19", build: nil) == "1.8.19")
        #expect(AppVersionInfo.formatted(shortVersion: "1.8.19", build: "") == "1.8.19")
    }

    @Test func fallsBackWhenVersionIsMissing() {
        #expect(AppVersionInfo.formatted(shortVersion: nil, build: "123") == "Unknown (123)")
        #expect(AppVersionInfo.formatted(shortVersion: "", build: "123") == "Unknown (123)")
    }
}
