'use client'

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { ReplanProvider } from "@/contexts/ReplanContext";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { OnboardingProvider } from "@/components/providers/OnboardingProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1
          }
        }
      })
  );

  return (
    <ReplanProvider>
      <LoadingProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <OnboardingProvider>
              {children}
              {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
            </OnboardingProvider>
          </AuthProvider>
        </QueryClientProvider>
      </LoadingProvider>
    </ReplanProvider>
  );
}
