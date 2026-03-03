"use client";

import { useUser, useAuth, SignOutButton } from "@clerk/nextjs";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      // Get the session token
      getToken().then((sessionToken) => {
        if (sessionToken) {
          setToken(sessionToken);
        }
      });
    }
  }, [isSignedIn, getToken]);

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Please sign in to continue.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome to TimeBud
            </h1>
            <SignOutButton>
              <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                Sign Out
              </button>
            </SignOutButton>
          </div>
          
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-2">
                User Information
              </h2>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-gray-600">
                  <span className="font-medium">Email:</span> {user.primaryEmailAddress?.emailAddress}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">User ID:</span> {user.id}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Name:</span> {user.firstName} {user.lastName}
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-2">
                Bearer Token (for API calls)
              </h2>
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 font-mono">
                    JWT Token (click to copy)
                  </span>
                  <button
                    onClick={copyToken}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="text-xs text-green-400 font-mono break-all">
                  {token || "Loading token..."}
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Use this token as a Bearer token in your API requests to the backend.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-2">
                API Usage Example
              </h2>
              <div className="bg-gray-900 rounded-lg p-4">
                <pre className="text-xs text-green-400 font-mono">
{`curl -X GET http://your-backend-api/protected-endpoint \\
  -H "Authorization: Bearer ${token || "your-token-here"}" \\
  -H "Content-Type: application/json"`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
