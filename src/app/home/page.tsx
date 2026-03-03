"use client";

import { useState, useEffect } from "react";
import { useAuth, SignOutButton } from "@clerk/nextjs";
import { getCurrentUserProfileUsersMeGet } from "@/client";
import { apiClient } from "@/lib/api-client";

export default function HomePage() {
  const { getToken } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("No authentication token available");
        }

        const response = await getCurrentUserProfileUsersMeGet({
          client: apiClient,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setUserData(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch user data");
        setLoading(false);
      }
    };

    fetchUserData();
  }, [getToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-gray-600">Loading user data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md mx-auto p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Authentication Error
          </h1>
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-gray-600 text-sm">
            Please check your backend connection and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to TimeBud
            </h1>
            <p className="text-xl text-gray-600">
              Successfully connected to backend!
            </p>
          </div>
          <SignOutButton>
            <button className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors min-h-[44px]">
              Sign Out
            </button>
          </SignOutButton>
        </div>

        <div className="bg-gray-50 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            User Profile Data
          </h2>
          
          {userData ? (
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Raw API Response
                </h3>
                <pre className="text-sm text-gray-600 overflow-x-auto bg-gray-100 p-4 rounded">
                  {JSON.stringify(userData, null, 2)}
                </pre>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userData.id && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="text-sm text-gray-500 mb-1">User ID</div>
                    <div className="text-lg font-medium text-gray-900">
                      {userData.id}
                    </div>
                  </div>
                )}
                
                {userData.email && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="text-sm text-gray-500 mb-1">Email</div>
                    <div className="text-lg font-medium text-gray-900">
                      {userData.email}
                    </div>
                  </div>
                )}
                
                {userData.name && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="text-sm text-gray-500 mb-1">Name</div>
                    <div className="text-lg font-medium text-gray-900">
                      {userData.name}
                    </div>
                  </div>
                )}
                
                {userData.clerk_user_id && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="text-sm text-gray-500 mb-1">Clerk User ID</div>
                    <div className="text-lg font-medium text-gray-900">
                      {userData.clerk_user_id}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-gray-600">
              No user data received from backend.
            </div>
          )}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-green-900 mb-2">
            ✅ End-to-End Connection Successful
          </h3>
          <p className="text-green-700">
            The frontend is successfully authenticated with Clerk and has made a 
            successful API call to the FastAPI backend's GET /users/me endpoint.
          </p>
        </div>
      </div>
    </div>
  );
}
