export type BeingType = 'space' | 'guest' | 'bot' | 'document';

export interface EntitySummary {
  id: string;
  name: string;
  type: BeingType;
  avatarUrl?: string;
}
