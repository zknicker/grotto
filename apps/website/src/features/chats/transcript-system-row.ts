export interface TranscriptDelivery {
    childSessionKey: string;
    childSessionName: string;
    childSessionPlatform: string | null;
    childSessionSource: string;
    childSessionTitle: string | null;
    childSessionType: 'chat' | 'cron' | 'link' | 'portal';
    deliveredAt: string | null;
    id: string;
    messageText: string | null;
    mode: string | null;
    parentSessionKey: string;
    parentSessionName: string;
    parentSessionPlatform: string | null;
    parentSessionSource: string;
    parentSessionTitle: string | null;
    parentSessionType: 'chat' | 'cron' | 'link' | 'portal';
    payload?: unknown;
    sourceMessageId: string | null;
    status: string | null;
    targetMessageId: string | null;
}

export type TranscriptSystemRow =
    | {
          accessEvent: {
              errorCode: string | null;
              errorMessage: string | null;
              id: string;
              occurredAt: string;
              status: string;
              targetSessionKey: string | null;
              toolName: string | null;
          };
          id: string;
          kind: 'system';
          systemKind: 'accessEvent';
          timestamp: string;
      }
    | {
          artifact: {
              artifactType: string;
              createdAt: string;
              id: string;
              mimeType: string | null;
              path: string | null;
              payload?: unknown;
          };
          id: string;
          kind: 'system';
          responseId?: string;
          systemKind: 'artifact';
          timestamp: string;
      }
    | {
          delivery: TranscriptDelivery;
          id: string;
          kind: 'system';
          systemKind: 'delivery';
          timestamp: string | null;
      }
    | {
          id: string;
          kind: 'system';
          responseId?: string;
          runtimeNotice: {
              agentId: string | null;
              compactionCount?: number | null;
              detail: string | null;
              kind: 'auto_compaction' | 'new_session' | 'status';
              sessionId: string | null;
              text: string;
              title: string;
          };
          systemKind: 'runtimeNotice';
          timestamp: string;
      }
    | {
          id: string;
          kind: 'system';
          responseId: string;
          systemKind: 'turnStatus';
          timestamp: string;
          turnStatus: {
              agentId: string;
              runId: string;
              sessionKey: string;
              status: 'stopped';
              text: string;
          };
      }
    | {
          id: string;
          kind: 'system';
          responseId?: string;
          systemKind: 'thinking';
          thinking: {
              id: string;
              messageId: string;
              sender: string;
              text: string;
              timestamp: string;
          };
          timestamp: string;
      };
