import SwiftUI

#Preview {
    MessageTimelineView(messages: ChatFixtures.messages, onOpenThread: { _ in })
}

#Preview("Empty") {
    MessageTimelineView(
        messages: [],
        emptyStateDescription: "Start the conversation in #product.",
        onOpenThread: { _ in }
    )
}
