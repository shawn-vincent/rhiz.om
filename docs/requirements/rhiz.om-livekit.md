# Rhiz.om — LiveKit Videoconferencing Spec (v 2025-07-12)

---

#### 1  Purpose & scope

Adds realtime audio/video to every **Space** using LiveKit. The spec covers the minimum set of behaviours the user already decided on, implemented with the most direct, documented LiveKit APIs.

---

#### 2  SDK & versions

| Layer                    | Package                                                    | Min version            | Notes                                                                     |
| ------------------------ | ---------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| Client                   | `livekit-client`                                           | 2.15.2                 | Core JS SDK ([LiveKit Docs][1])                                           |
| React helpers (optional) | `@livekit/components-react` + `@livekit/components-styles` | latest matching 2.15.x | Zero-state components; can be replaced with custom UI ([LiveKit Docs][2]) |

---

#### 3  Room lifecycle

1. **Enter space ➜ join room**

   ```ts
   const room = new Room();
   await room.connect(wsUrl, token);           // token encodes space-name + identity
   ```

   — API from docs ([LiveKit Docs][3])
2. **Leave space / browser tab closed ➜ `room.disconnect()`** (or rely on SDK’s auto-disconnect after 15 s) ([LiveKit Docs][3])

Room-name **= Space ID** (string). Each participant identity **= Being ID**.

---

#### 4  Track publish / mute logic

| UI control (navbar, right side) | Action                                    | LiveKit call                                                       |
| ------------------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| **Video-mute toggle**           | `true ➜ false` Enable camera & publish    | `room.localParticipant.setCameraEnabled(true)` ([LiveKit Docs][4]) |
|                                 | `false ➜ true` Disable camera & unpublish | `…setCameraEnabled(false)`                                         |
| **Audio-mute toggle**           | Same pattern                              | `…setMicrophoneEnabled(true/false)` ([LiveKit Docs][4])            |

The first enable triggers browser permission prompts (handled by SDK) ([LiveKit Docs][4]).

---

#### 5  Rendering rules

| Source                 | Render location                                                                                                                                                          | Style                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **Local video**        | Fixed 1 × circular element adjacent to the “new intention” bubble (bottom-right of chat pane).                                                                           | `width = height = avatarSize; border-radius: 50%` |
| **Remote participant** | Their current avatar container. If they have a published video track, replace static avatar with live video clipped to the same circle. Otherwise keep the static image. | Same CSS masking as above                         |

*Attach code* (runs on `RoomEvent.TrackSubscribed`):

```ts
function onTrack(track, pub, participant) {
  if (track.kind === 'video') {
    const el = track.attach();                  // creates <video>
    mountIntoCircularAvatar(participant.id, el);
  } else if (track.kind === 'audio') {
    track.attach();                             // audio plays; no DOM swap needed
  }
}
room.on(RoomEvent.TrackSubscribed, onTrack);
```

Attachment API from docs ([LiveKit Docs][5]).

When a video track is muted/unpublished (`TrackMuted`, `TrackUnpublished`), detach and restore the static avatar.

Error handling - ensure all LiveKit errors are surfaced to the user, either by rendering an avatar or video preview as a red error, or using a generic error handling mechanism.

---

#### 6  Events to handle

| Event                                           | Purpose                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `RoomEvent.TrackSubscribed / TrackUnsubscribed` | Mount / unmount media elements                                                                         |
| `RoomEvent.ParticipantConnected /-Disconnected` | Add / remove avatar DOM nodes                                                                          |
| `RoomEvent.TrackMuted /-Unmuted`                | Toggle avatar-video overlay                                                                            |
| `RoomEvent.VideoPlaybackStatusChanged`          | If browser blocks autoplay, call `room.startVideo()` inside a user-gesture handler ([LiveKit Docs][6]) |
| `RoomEvent.Reconnecting /-Reconnected`          | Optional: show transient “reconnecting” overlay                                                        |

No additional custom events defined.

---

#### 7  Access-token requirements

* 1 token = 1 participant; generated server-side.
* Claims: room name, participant identity, publish & subscribe permissions for audio/video.
* Short (1h) expiry; refresh by reconnecting.

No server-side recording, egress or transcoding is required now.

---

#### 8  Error & edge handling (minimal)

| Case                     | Behaviour                                                             |
| ------------------------ | --------------------------------------------------------------------- |
| Device permission denied | Keep mute toggles off, show tooltip “Camera blocked” / “Mic blocked”. |
| Track publish failure    | Revert toggle state, surface toast with SDK error.                    |
| Autoplay blocked         | Surface inline “Click to start video” until `startVideo()` succeeds.  |

---

#### 9  Recommended file/DOM structure

```txt
SpacePage/
 ├─ LiveKitProvider.ts       (sets up Room, context)
 ├─ VideoControls.tsx        (navbar buttons)
 ├─ Avatars/
 │   ├─ AvatarCircle.tsx     (wraps <img> or <video>)
 │   └─ useAvatarMedia.ts    (binds Track events → avatar node)
 └─ LocalPreviewCircle.tsx   (renders local camera near IntentionBubble)
```

All video elements share a common class `.avatar-video` for consistent circular clipping.

---

#### 10  Security & privacy

* All media flows are DTLS-SRTP via WebRTC.
* Tokens are JWTs signed with server secret; HTTPS & WSS only.
* Expose in-space UI to **Stop Camera / Stop Mic** at any time (already covered by toggles).

---

#### 11  Performance notes

* Default simulcast enabled by SDK for camera tracks; accept LiveKit’s adaptiveStream defaults.
* Avatars are small (<128 px); bandwidth per participant remains low.
* No screen-share required; leave out related code.

---

#### 12  Future extension placeholders (out-of-scope)

* Screen sharing, composite layout, server recording (Egress)
* Spatial audio or audio-reactive visuals
* Participant hand-raise / moderation features

These are intentionally **not** included per instruction to avoid invention.

---

**End of spec.**

[1]: https://docs.livekit.io/reference/client-sdk-js/?utm_source=chatgpt.com "LiveKit JS Client SDK - v2.15.2"
[2]: https://docs.livekit.io/reference/components/react/?utm_source=chatgpt.com "React Components - LiveKit Docs"
[3]: https://docs.livekit.io/home/client/connect/ "Connecting to LiveKit | LiveKit Docs"
[4]: https://docs.livekit.io/home/client/tracks/publish/ "Camera & microphone | LiveKit Docs"
[5]: https://docs.livekit.io/home/client/tracks/subscribe/?utm_source=chatgpt.com "Subscribing to tracks - LiveKit Docs"
[6]: https://docs.livekit.io/reference/client-sdk-js/enums/RoomEvent.html?utm_source=chatgpt.com "RoomEvent | LiveKit JS Client SDK - v2.15.2"
