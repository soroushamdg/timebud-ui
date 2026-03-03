"use client";

import { useAuth } from "@clerk/nextjs";

export function useAuthToken() {
  const { getToken } = useAuth();
  
  return {
    getToken: getToken
  };
}

export async function getAuthHeaders() {
  return async (token: string | null) => {
    if (!token) {
      throw new Error("No authentication token available");
    }
    
    return {
      Authorization: `Bearer ${token}`,
    };
  };
}
