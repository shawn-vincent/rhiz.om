'use client';

import { Button } from '~/components/ui/button';
import { useLiveKitContext } from '~/contexts/livekit-context';

export function LiveKitTestButton() {
  try {
    const { isConnected, sendMessage, currentRoomId } = useLiveKitContext();

    const handleSendTestMessage = async () => {
      try {
        await sendMessage(`Test message at ${new Date().toLocaleTimeString()}`);
      } catch (error) {
        console.error('Failed to send test message:', error);
      }
    };

    if (!isConnected) {
      return (
        <div className="text-sm text-white/60">
          LiveKit not connected to {currentRoomId}
        </div>
      );
    }

    return (
      <Button
        onClick={handleSendTestMessage}
        variant="outline"
        size="sm"
        className="w-full border-white/20 bg-transparent hover:bg-white/10"
      >
        Send Test Message
      </Button>
    );
  } catch (error) {
    // Not in a LiveKit context (not on a space page)
    return (
      <div className="text-sm text-white/60">
        Not in a space - navigate to a space to test LiveKit
      </div>
    );
  }
}