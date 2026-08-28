import CoreGraphics
import SwiftUI
import Testing
@testable import GrottoUI

struct DrawerVeilTests {
    @Test func paintsTheVeilWhileTheCanvasIsAsideForAnInteractiveClose() {
        #expect(GrottoDrawerVeil.isPainted(progress: 1, close: .interactive))
        #expect(GrottoDrawerVeil.isPainted(progress: 0.2, close: .interactive))
    }

    @Test func paintsNoVeilOverAClosedCanvas() {
        #expect(!GrottoDrawerVeil.isPainted(progress: 0, close: .interactive))
        #expect(!GrottoDrawerVeil.isPainted(progress: 0, close: .chatSelection))
    }

    @Test func dropsTheVeilTheMomentAChatSelectionClosesTheDrawer() {
        #expect(!GrottoDrawerVeil.isPainted(progress: 1, close: .chatSelection))
        #expect(!GrottoDrawerVeil.isPainted(progress: 0.5, close: .chatSelection))
    }

    @Test func fadesTheVeilInWithTheCanvasTravel() {
        #expect(GrottoDrawerVeil.opacity(for: .light, progress: 0) == 0)
        #expect(
            GrottoDrawerVeil.opacity(for: .light, progress: 0.5)
                < GrottoDrawerVeil.opacity(for: .light, progress: 1)
        )
    }

    @Test func liftsTheCanvasInDarkModeInsteadOfDarkeningIt() {
        #expect(GrottoDrawerVeil.color(for: .dark) == .white)
        #expect(
            GrottoDrawerVeil.opacity(for: .dark, progress: 1)
                < GrottoDrawerVeil.opacity(for: .light, progress: 1)
        )
    }
}
