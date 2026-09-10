import CoreGraphics
import SwiftUI
import Testing
@testable import HausUI

struct DrawerVeilTests {
    @Test func paintsTheVeilWhileTheCanvasIsAsideForAnInteractiveClose() {
        #expect(HausDrawerVeil.isPainted(progress: 1, close: .interactive))
        #expect(HausDrawerVeil.isPainted(progress: 0.2, close: .interactive))
    }

    @Test func paintsNoVeilOverAClosedCanvas() {
        #expect(!HausDrawerVeil.isPainted(progress: 0, close: .interactive))
        #expect(!HausDrawerVeil.isPainted(progress: 0, close: .chatSelection))
    }

    @Test func dropsTheVeilTheMomentAChatSelectionClosesTheDrawer() {
        #expect(!HausDrawerVeil.isPainted(progress: 1, close: .chatSelection))
        #expect(!HausDrawerVeil.isPainted(progress: 0.5, close: .chatSelection))
    }

    @Test func fadesTheVeilInWithTheCanvasTravel() {
        #expect(HausDrawerVeil.opacity(for: .light, progress: 0) == 0)
        #expect(
            HausDrawerVeil.opacity(for: .light, progress: 0.5)
                < HausDrawerVeil.opacity(for: .light, progress: 1)
        )
    }

    @Test func liftsTheCanvasInDarkModeInsteadOfDarkeningIt() {
        #expect(HausDrawerVeil.color(for: .dark) == .white)
        #expect(
            HausDrawerVeil.opacity(for: .dark, progress: 1)
                < HausDrawerVeil.opacity(for: .light, progress: 1)
        )
    }
}
