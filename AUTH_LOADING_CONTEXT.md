# Authentication & Loading Issue - Context for Reimplementation

## Problem Summary

User authentication and data loading are **inconsistent** between soft refresh (Cmd+R) and hard refresh (browser refresh button). The app gets stuck in loading states or redirect loops, with React Query queries never executing despite appearing to be enabled.

---

## Current Symptoms

1. **Auth State Inconsistency**
   - `authReady: true` but `user: undefined` and `isLoading: true`
   - Queries have `enabled: authReady` but never execute
   - Missing console logs indicate hooks aren't running: `[useCurrentUser] Auth check:`, `[useProjects] Fetching projects:`

2. **Component Lifecycle Issues**
   - `AuthProvider`'s `useEffect` never runs (no console output)
   - Middleware redirects to `/auth/login` repeatedly
   - User has **NO Supabase cookies/session** (not actually logged in)

3. **Inconsistent Behavior**
   - Sometimes works with soft refresh (Cmd+R)
   - Fails with hard refresh (browser refresh button)
   - When manually navigating to `/auth/login`, it redirects to home and THEN data loads

---

## Technical Stack

- **Framework**: Next.js 16.1.6 (Turbopack)
- **State Management**: React Query (TanStack Query)
- **Auth**: Supabase Auth
- **Language**: TypeScript + React

---

## Current Architecture

### Key Files & Their Roles

1. **`/src/components/providers/AuthProvider.tsx`**
   - Manages global auth session state
   - Provides `authReady` flag to indicate when auth is initialized
   - Wraps the app to provide auth context

2. **`/src/hooks/useAuth.ts`**
   - React Query hook for current user data
   - Has `enabled: authReady` flag (problematic)
   - Calls `supabase.auth.getUser()`

3. **`/src/hooks/useProjects.ts`**
   - React Query hook for user projects
   - Has `enabled: authReady` flag (problematic)
   - Depends on authenticated user

4. **`/src/hooks/useTasks.ts`**
   - React Query hook for user tasks
   - Has `enabled: authReady` flag (problematic)
   - Depends on authenticated user

5. **`/src/app/(main)/page.tsx`** (Home component)
   - Main dashboard page
   - Shows loading state while `!authReady || userLoading`
   - Redirects to `/auth/login` if no user
   - Currently has Rules of Hooks violation (conditional returns before all hooks)

6. **`/src/middleware.ts`** (Server-side)
   - Checks auth on server before page loads
   - Redirects unauthenticated users to `/auth/login`

---

## Problematic Changes Made (May Need Reverting)

### AuthProvider.tsx
- Added `authReady` state starting as `true` (should be `false`)
- Added `useEffect` to check session (but it doesn't run reliably)
- Added complex user creation logic that causes lifecycle issues

### Hooks (useAuth, useProjects, useTasks)
- Added `enabled: authReady` flag to all React Query hooks
- This creates a dependency chain that doesn't execute reliably

### Home Component (page.tsx)
- Added conditional returns before all hooks are called
- **Violates Rules of Hooks** - causes "change in order of Hooks" error
- Shows loading/redirect logic but hooks order is wrong

### Previously Removed (Context)
- `OnboardingProvider` from provider chain
- `SplashScreen` from root layout
- `AppWrapper` usage from main page

---

## Root Cause Hypothesis

**Race Condition Between Auth Initialization and Query Execution:**

1. `authReady` starts as `true` but session isn't actually checked yet
2. React Query hooks have `enabled: authReady` but the query functions don't execute
3. `AuthProvider`'s `useEffect` doesn't run reliably (React lifecycle/hydration issue)
4. Middleware (server-side) and client-side auth checks conflict
5. User isn't actually logged in (no Supabase session) but app thinks auth is ready

**Result:** Queries wait for `authReady: true`, but even when true, they don't execute because the auth session was never properly initialized.

---

## Current Error

```
React has detected a change in the order of Hooks called by Home.
```

**Cause:** Conditional returns (`if (!authReady || userLoading) return <Loading />`) appear before all hooks are called, violating React's Rules of Hooks.

---

## Goal for Reimplementation

Create a **simple, reliable auth and loading system** that:

### Requirements
1. ✅ Works consistently across soft refresh (Cmd+R) and hard refresh (browser button)
2. ✅ Eliminates race conditions between middleware and client-side auth
3. ✅ Provides proper loading states during auth initialization
4. ✅ Handles unauthenticated users gracefully (redirect to login)
5. ✅ Ensures data queries execute reliably when user is authenticated
6. ✅ Follows React Rules of Hooks (all hooks before conditional returns)

### Design Principles
- **Simplicity over complexity** - avoid over-engineered auth state management
- **Single source of truth** - auth state should come from one place
- **Fail gracefully** - if no session, redirect cleanly without loops
- **Predictable loading** - clear loading states that resolve consistently

---

## Key Files to Review/Modify

```
/src/components/providers/AuthProvider.tsx
/src/hooks/useAuth.ts
/src/hooks/useProjects.ts
/src/hooks/useTasks.ts
/src/app/(main)/page.tsx
/src/middleware.ts (if needed)
```

---

## Suggested Approach for Reimplementation

### Option 1: Remove `authReady` Entirely
- Let each React Query hook check auth independently
- Remove the `enabled: authReady` dependencies
- Simplify `AuthProvider` to just provide Supabase client

### Option 2: Fix `authReady` Initialization
- Start `authReady` as `false`
- Run `useEffect` in `AuthProvider` to check session on mount
- Set `authReady: true` only after session check completes
- Ensure `useEffect` runs reliably (check dependencies)

### Option 3: Server-Side Session Handling
- Rely more on middleware for auth checks
- Use server components for initial auth state
- Minimize client-side auth complexity

---

## Testing Checklist

After reimplementation, verify:

- [ ] Hard refresh (browser button) loads user data consistently
- [ ] Soft refresh (Cmd+R) loads user data consistently
- [ ] Unauthenticated users redirect to `/auth/login` without loops
- [ ] No "Rules of Hooks" errors in console
- [ ] Console logs show queries executing: `[useCurrentUser] Auth check:`, `[useProjects] Fetching projects:`
- [ ] `AuthProvider` `useEffect` runs and logs appear
- [ ] No infinite redirect loops between `/` and `/auth/login`

---

## Additional Context

**User Confirmation:** User has NO Supabase cookies/session (not logged in), so the app should redirect to login immediately and consistently.

**Middleware Behavior:** Middleware redirects to `/auth/login` but component still renders, suggesting client-side and server-side auth checks are out of sync.

**Inconsistent Success:** Sometimes navigating to `/auth/login` manually triggers a redirect to home that THEN loads data, suggesting the auth flow works but timing is wrong.

---

## Questions to Consider

1. Should `authReady` exist at all, or should each hook check auth independently?
2. Should we rely more on server-side middleware for auth state?
3. Is the `AuthProvider` `useEffect` dependency array correct?
4. Are we hydrating client state properly after server-side rendering?
5. Should loading states be handled at the layout level instead of page level?

---

**End of Context Document**
