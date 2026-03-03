import { createClient } from "@/client/client";

export const apiClient = createClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000",
});
