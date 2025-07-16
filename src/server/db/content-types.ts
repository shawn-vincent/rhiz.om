// src/server/db/content-types.ts
export type ContentNode = string | ContentDataIsland;

export interface ContentDataIsland {
  type: string;
  props?: Record<string, any>;
  content?: ContentNode[];
}
