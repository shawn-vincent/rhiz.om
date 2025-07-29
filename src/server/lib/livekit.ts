import {
  AccessToken,
  RoomServiceClient,
  type VideoGrant,
  DataPacket_Kind,
} from 'livekit-server-sdk';
import { env } from '~/env';

// Server API host (HTTPS) for RoomServiceClient
const HOST = env.LIVEKIT_HOST.replace('wss://', 'https://');
const API_KEY = env.LIVEKIT_API_KEY;
const API_SECRET = env.LIVEKIT_API_SECRET;
const WS_URL = env.LIVEKIT_WS_URL; // WebSocket URL for client connections

export const roomService = new RoomServiceClient(HOST, API_KEY, API_SECRET);

export interface JoinTokenOptions {
  roomId: string;        // Being ID for the space/room (e.g., "@some-space")
  identity: string;      // Being ID for the logged-in user (from ctx.auth.beingId)
  name?: string;         // Display name for the user
  ttlSeconds?: number;   // Token expiry (default 1 hour)
  grants?: Partial<VideoGrant>;
}

/**
 * Generate a LiveKit join token for a user Being to join a space Being
 * 
 * Room Mapping: LiveKit roomId = Being ID of the space page user is visiting
 * User Identity: LiveKit identity = Being ID of the authenticated user
 * 
 * Example: User with Being ID "@alice" visits space page "/beings/@workspace"
 * → Connects to LiveKit room "@workspace" with identity "@alice"
 */
export async function createJoinToken(opts: JoinTokenOptions) {
  const { roomId, identity, name, ttlSeconds = 3600, grants = {} } = opts;

  const at = new AccessToken(API_KEY, API_SECRET, { 
    identity, 
    ttl: ttlSeconds 
  });
  
  if (name) at.name = name;

  // Grant permissions for data-only chat (no audio/video for now)
  const grant: VideoGrant = {
    roomJoin: true,
    room: roomId,
    canPublish: false,        // No audio/video publishing
    canPublishData: true,     // Allow data publishing
    canSubscribe: true,       // Allow data subscription
    ...grants,
  };
  
  at.addGrant(grant);
  
  const token = await at.toJwt();
  
  return {
    token,
    wsUrl: WS_URL,
    roomId,
    identity
  };
}

export interface BroadcastOptions {
  roomId: string;           // Being ID for the room
  text: string;            // Message content
  topic?: string;          // Message topic/type
  toIdentities?: string[]; // Target specific Being IDs
}

/**
 * Broadcast a message from server to all participants in a room
 * Used for system messages, bot responses, etc.
 */
export async function broadcastToRoom(opts: BroadcastOptions) {
  const { roomId, text, topic = 'chat', toIdentities } = opts;
  
  const payload = new TextEncoder().encode(text);
  
  await roomService.sendData(roomId, payload, DataPacket_Kind.RELIABLE, {
    topic,
    destinationIdentities: toIdentities,
  });
  
  return { success: true, roomId, topic };
}