import SwiftUI

/// Canvas geometry and release decisions for the sidebar drawer. The canvas
/// tracks the finger one to one inside its travel; `DrawerInteraction` owns the
/// math and this extension owns the state it animates.
extension GrottoShellView {
    func canvasOffset(drawerWidth: CGFloat) -> CGFloat {
        guard let dragTranslation else { return drawerPresented ? drawerWidth : 0 }
        return DrawerInteraction.offset(
            isOpen: drawerPresented,
            translation: dragTranslation,
            width: drawerWidth
        )
    }

    func canvasCornerRadius(drawerWidth: CGFloat) -> CGFloat {
        38 * drawerProgress(drawerWidth: drawerWidth)
    }

    func drawerProgress(drawerWidth: CGFloat) -> CGFloat {
        guard drawerWidth > 0 else { return 0 }
        return min(1, max(0, canvasOffset(drawerWidth: drawerWidth) / drawerWidth))
    }

    func handleDrawerPan(_ pan: DrawerPan, drawerWidth: CGFloat) {
        switch pan {
        case .changed(let translation):
            dragTranslation = translation
        case .ended(let translation, let velocity):
            let offset = DrawerInteraction.offset(
                isOpen: drawerPresented,
                translation: translation,
                width: drawerWidth
            )
            let opens = DrawerInteraction.settlesOpen(
                offset: offset,
                velocity: velocity,
                width: drawerWidth
            )
            let settleVelocity = DrawerInteraction.settleVelocity(
                velocity: velocity,
                offset: offset,
                target: opens ? drawerWidth : 0
            )
            withAnimation(.interpolatingSpring(duration: 0.38, bounce: 0.06, initialVelocity: settleVelocity)) {
                dragTranslation = nil
                drawerPresented = opens
            }
        }
    }

    func setDrawer(open: Bool) {
        withAnimation(.interpolatingSpring(duration: 0.38, bounce: 0.06)) {
            dragTranslation = nil
            drawerPresented = open
        }
    }
}
