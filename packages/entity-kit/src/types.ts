export type BeingKind = 'space' | 'guest' | 'bot' | 'document';

export interface EntitySummary {
  id: string;
  name: string;
  kind: BeingKind;
  avatarUrl?: string;
}
