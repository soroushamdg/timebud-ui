'use client'

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState } from "react";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { ReplanProvider } from "@/contexts/ReplanContext";
import { AuthProvider, useAuth } from "@/components/providers/AuthProvider";
import { OnboardingProvider } from "@/components/providers/OnboardingProvider";
import { useSyncDailyBudget } from "@/hooks/useAISettings";
import { useTimezoneSync } from "@/hooks/useTimezoneSync";
import { useActiveFocusSession, useFocusSessionRealtime } from "@/hooks/useSessions";
import { useFocusSessionStore, PlannedTask } from "@/stores/sessionStore";
import { SimpleToast } from "@/components/ui/SimpleToast";
import { Session } from "@supabase/supabase-js";

function BudgetSync() {
  useSyncDailyBudget();
  return null;
}

// Mounted once near the app root (not just on the focus-run screen) so a session
// started/paused/stopped on another device is reflected here even while sitting on
// Home. Two propagation paths feed the same store:
//  - useFocusSessionRealtime: live postgres_changes events for anything that changes
//    *after* this device is connected (near-instant).
//  - the effect below: seeds the store from useActiveFocusSession's own fetch/poll, so
//    a cold app open also picks up a session that was already running before this
//    device connected (realtime only streams events, it doesn't backfill).
function FocusSessionSync() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  useFocusSessionRealtime(userId);

  const { data: activeFocusSession } = useActiveFocusSession();
  useEffect(() => {
    // undefined = query hasn't resolved yet, leave local state alone. Once it has
    // resolved, this query is authoritative for "what is my active session right now"
    // (there's at most one), so it should win over a stale local session id either way —
    // apply what it found (force: true, see sessionStore's applyServerSnapshot), or, if
    // it found nothing but this device still thinks a session is running/paused (e.g. a
    // crashed tab, or the run was stopped elsewhere while this device was asleep), clear
    // that stale local state instead of leaving the device stuck showing a dead run.
    if (activeFocusSession === undefined) return;

    if (activeFocusSession) {
      useFocusSessionStore.getState().applyServerSnapshot({
        id: activeFocusSession.id,
        status: activeFocusSession.status,
        start_time: activeFocusSession.start_time,
        paused_at: activeFocusSession.paused_at,
        total_paused_seconds: activeFocusSession.total_paused_seconds,
        budget_minutes: activeFocusSession.budget_minutes,
        planned_tasks: activeFocusSession.planned_tasks as unknown as PlannedTask[],
      }, { force: true });
    } else {
      const { focusSessionId, status } = useFocusSessionStore.getState();
      if (focusSessionId && (status === 'running' || status === 'paused')) {
        useFocusSessionStore.getState().clearFocusSession();
      }
    }
  }, [activeFocusSession]);

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
            <FocusSessionSync />
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
