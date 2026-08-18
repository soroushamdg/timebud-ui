'use client'

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { ReplanProvider } from "@/contexts/ReplanContext";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { OnboardingProvider } from "@/components/providers/OnboardingProvider";
import { useSyncDailyBudget } from "@/hooks/useAISettings";
import { useTimezoneSync } from "@/hooks/useTimezoneSync";
import { SimpleToast } from "@/components/ui/SimpleToast";
import { Session } from "@supabase/supabase-js";

function BudgetSync() {
  useSyncDailyBudget();
  return null;
}

function TimezoneSync() {
  const { justSyncedTo, resetJustSynced } = useTimezoneSync();
  return (
    <SimpleToast
      isVisible={!!justSyncedTo}
      message={justSyncedTo ? `Timezone updated to ${justSyncedTo}` : ""}
      type="info"
      onDismiss={resetJustSynced}
    />
  );
}

interface ProvidersProps {
  children: React.ReactNode
  initialSession: Session | null
}

export function Providers({ children, initialSession }: ProvidersProps) {
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
          <AuthProvider initialSession={initialSession}>
            <BudgetSync />
            <TimezoneSync />
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
