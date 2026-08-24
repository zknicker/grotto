export const developmentChatDemoId = 'cht_demo';
// Multi-agent demo chat: two agent seats sharing one channel.
export const developmentChatTeamDemoId = 'cht_demo_team';
// Visuals gallery: one turn per rendered visual, plus fallback states.
export const developmentChatVisualsDemoId = 'cht_demo_visuals';

export const developmentChatDemoIds = {
    demo: developmentChatDemoId,
    team: developmentChatTeamDemoId,
    visuals: developmentChatVisualsDemoId,
    activityTurn: developmentChatDemoId,
    artifactLinks: developmentChatDemoId,
    attachment: developmentChatDemoId,
    longContent: developmentChatDemoId,
    streamingStack: developmentChatDemoId,
    toolHeaders: developmentChatDemoId,
    turnTimeline: developmentChatDemoId,
} as const;

export const obsoleteDevelopmentChatDemoIds = [
    'cht_demo_activity_turn',
    'cht_demo_artifact_links',
    'cht_demo_attachment',
    'cht_demo_calendar_day',
    'cht_demo_calendar_event',
    'cht_demo_charts',
    'cht_demo_composed_chart',
    'cht_demo_line_chart',
    'cht_demo_long_content',
    'cht_demo_merchbase_sales_chart',
    'cht_demo_rich_response_catalog',
    'cht_demo_streaming_stack',
    'cht_demo_tool_headers',
    'cht_demo_turn_timeline',
    'cht_demo_widgets',
] as const;
