"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "~/components/ui/button";

interface DevModeAuthProps {
  callbackUrl?: string;
  isDevelopment?: boolean;
}

export function DevModeAuth({ callbackUrl, isDevelopment = false }: DevModeAuthProps) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="mx-auto w-full max-w-md rounded-lg border border-gray-700 bg-gray-800/50 p-6 shadow-lg">
      {isDevelopment && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">🔧 Dev Mode Authentication</h2>
            <p className="mt-2 text-sm text-gray-400">
              Bypass authentication for development and testing. Only available in development mode.
            </p>
          </div>
          <div className="space-y-4">
            <Button 
              onClick={async () => {
                console.log("🚀 Dev login button clicked!");
                setIsLoading(true);
                try {
                  const devLoginUrl = `/api/auth/dev-login?callbackUrl=${encodeURIComponent(callbackUrl || "/")}`;
                  console.log("🔗 Redirecting to:", devLoginUrl);
                  
                  // For dev mode, we'll set up a test session directly
                  window.location.href = devLoginUrl;
                } catch (error) {
                  console.error("❌ Dev login error:", error);
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? "Logging in..." : "🚀 Dev Login as @test-user-being"}
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-gray-800 px-2 text-gray-500">or</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => signIn("google", { callbackUrl })}
              className="w-full border-gray-600 text-white hover:bg-gray-700"
            >
              Continue with Google (Normal Auth)
            </Button>
          </div>
        </>
      )}
      
      {!isDevelopment && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Welcome to Rhiz.om</h2>
            <p className="mt-2 text-sm text-gray-400">
              Sign in to join the conversation
            </p>
          </div>
          <Button 
            onClick={() => signIn("google", { callbackUrl })}
            className="w-full"
          >
            Continue with Google
          </Button>
        </>
      )}
    </div>
  );
}