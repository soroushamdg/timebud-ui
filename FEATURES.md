# TimeBud — Feature & Functionality Reference

A task/time-management PWA. "Projects" are called Missions, "tasks" are Jobs, "milestones" are Objectives in the UI (same underlying data model). Built on Next.js 16 (App Router), Supabase (Postgres + Auth + Storage), TanStack Query, Zustand.

## 1. Views / Screens

1. `/` — Home. Daily dashboard: greeting/level/streak, missions strip, "Right Now" status card, top job preview, This Week stats, Start Run button.
2. `/tasks/all` — All Jobs. Full job list across all missions, day-grouped, filterable and sortable.
3. `/tasks/new` — New Job/Objective. Form to create a job or objective, with recurrence and dependency pickers.
4. `/projects/[id]` — Mission Detail. A single mission's jobs/objectives list, progress ring, edit mission, memories panel.
5. `/projects/new` — New Mission. Create a mission with name, difficulty, color, avatar, deadline.
6. `/projects/select` — Missions List. Grid of all missions; tap to toggle active/paused, long-press for more options.
7. `/planner` — Week Ahead. Multi-day forward view of the auto-planned schedule.
8. `/logs` — Run History. Past focus sessions with per-session stats and XP.
9. `/gantt` — Timeline. Gantt-style chart of jobs/objectives across missions, with a List view toggle.
10. `/chat` — Chat with Bud. Full-screen AI assistant conversation.
11. `/credits` — Credits & Billing. Balance, renewal date, subscription status, top-up packs.
12. `/profile` — Profile. ID-card style header, XP bar, stats, badges, settings list.
13. `/profile/notifications` — Notification Settings. Per-notification-type toggles and times.
14. `/profile/calendar` — Calendar Settings. Google Calendar connection status, block-to-mission mappings.
15. `/session/focus` — Focus Run. Active timed work session, one job list, checkmarks, partial completion.
16. `/onboarding` — Onboarding. 4-screen intro shown once after first login.
17. `/auth/login` — Login. Email/password sign-in.
18. `/auth/signup` — Signup. Email/password account creation, email confirmation step.
19. `/add` — Legacy quick-add modal (type picker for job vs. mission), superseded by Quick Capture.
20. `/v1/*` — Frozen snapshot of the pre-redesign app, kept as a fallback; not maintained going forward.

## 2. Core Task & Mission Management

21. Missions (projects) group related jobs and objectives under one deadline/difficulty/color/avatar.
22. Objectives (milestones) are non-actionable markers inside a mission that group jobs conceptually.
23. Jobs (tasks) are the actionable unit — title, description, estimate, due date, priority.
24. Jobs and objectives share one underlying table, distinguished by an `item_type` field.
25. Solo jobs exist outside any mission.
26. Manual drag-to-reorder of jobs/objectives within a mission (desktop) or via sort mode toggle.
27. Deadline-based sort mode as an alternative to manual order.
28. Job dependencies — a job can require other jobs to complete first; dependent jobs show locked with a reason.
29. Circular-dependency prevention when linking jobs.
30. Recurring jobs — daily, specific weekdays, or every N days, with an end date or occurrence count.
31. Missed-recurrence behavior is configurable — show as overdue or auto-skip.
32. On-hold state for a job — indefinite, until a date, or until another job completes.
33. Priority flag on any job, surfaced with an icon and used as a planner-scoring boost.
34. Partial completion — log a job as partly done with a new remaining-time estimate instead of fully completing it.
35. Deferring a job — push its due date forward via a date picker.
36. Swipe gestures on mobile (right = complete/undo, left = delete) inside Mission Detail's job list.
37. Long-press context menu on mobile for complete/priority/delete actions.
38. Mission color and custom avatar (upload or AI-generated) used throughout the app for visual identity.
39. Mission difficulty (easy/medium/hard) multiplies the XP a job in that mission earns.
40. Pin a job to always appear at the top of the daily plan regardless of the algorithm.
41. Manually add a specific job into today's plan outside the normal algorithm selection.

## 3. Auto-Planning Engine

42. A deterministic budget-based scheduler (`planSession`) picks which jobs fit a given time budget.
43. Scoring considers deadline urgency, overdue status, priority flags, and dependency-unlock value.
44. Objectives inherit deadline urgency down to their jobs when scoring.
45. Partial jobs can carry remaining minutes over to the next planning pass.
46. A week-ahead variant (`planWeek`) projects the same algorithm forward across multiple days, carrying unfinished pool items day to day.
47. Daily time budget is user-configurable from Profile.
48. "Won't fit" detection flags jobs that don't fit the week at the current pace.
49. The same planning engine powers Home's daily plan, Week Ahead, the AI's `plan_session` tool, and calendar-block-scoped plans.

## 4. Gamification

50. XP is awarded per completed job, scaled by that job's mission difficulty.
51. A one-time bonus is awarded when a mission's last job is completed.
52. XP is symmetrically clawed back if a completed job (or a just-finished mission) is un-completed.
53. XP totals map to a level via a quadratic level curve, with a level title (Rookie, Grinder, Operator, Legend).
54. A level-up modal celebrates crossing a level threshold.
55. A mission-complete modal celebrates finishing all jobs in a mission.
56. A daily activity streak counts consecutive days with any job or session activity.
57. Streak milestones (3/7/14/30/60/100 days) award bonus XP and a push notification.
58. Profile displays derived badges unlocked by usage milestones (no extra schema — computed from existing stats).
59. XP-earned totals appear per mission, per job (as a preview chip), and per run history entry.

## 5. AI Assistant ("Bud")

60. A chat-based assistant that can read and modify missions/jobs/objectives on the user's behalf.
61. Supports three LLM providers — Anthropic Claude, OpenAI, Google Gemini — user-selectable in Settings.
62. "Thinking mode" toggle for deeper reasoning, currently only implemented for the Anthropic provider.
63. Optional web research capability (via Perplexity) the assistant can invoke for external information.
64. Tool: load full context (jobs + notes) for a specific mission before acting.
65. Tool: create a job, with optional due date, estimate, priority, dependency.
66. Tool: edit an existing job's fields.
67. Tool: delete a job — requires user confirmation before executing.
68. Tool: bulk-create many jobs at once, including dependencies between the new jobs.
69. Tool: create an objective under a mission.
70. Tool: edit or delete an objective — delete requires confirmation.
71. Tool: create a new mission — requires confirmation via a preview step showing the mission and its jobs before creating anything.
72. Tool: edit an existing mission's name/description/deadline/status/color/priority.
73. Tool: save or remove a persistent memory/note against a mission — removal requires confirmation.
74. Tool: mark a job complete.
75. Tool: set or clear a job's dependencies.
76. After creating jobs with cross-references, the assistant resolves real IDs and re-links dependencies automatically.
77. `plan_session` action lets the assistant trigger the same auto-planning engine used elsewhere.
78. Conversation history and confirmation state are tracked so multi-step flows (confirm, then execute) work across turns.

## 6. Google Calendar Integration

79. Connect a Google account via OAuth to let TimeBud read a dedicated calendar.
80. On connect, TimeBud automatically creates (or finds) a calendar named "TimeBud" in the user's Google account.
81. A background job polls that calendar every 15 minutes and caches upcoming/active events locally.
82. Any newly-seen event title is surfaced once in Settings for the user to map to one or more missions.
83. A block title can map to multiple missions at once (e.g. one "Study" block covering several subjects).
84. Once confirmed, a mapping is remembered permanently, including all future occurrences of a recurring block.
85. When a mapped block is currently active, Home's plan automatically scopes to that block's minutes and missions instead of the whole-day budget.
86. A push notification fires when a mapped block starts, deep-linking into Home already scoped to it.
87. Mission Detail shows a small badge when that mission is linked to a confirmed calendar block.
88. Disconnecting revokes the Google token and deletes the stored connection.
89. Full account-level calendar scope is requested (not read-only) specifically so TimeBud can create the dedicated calendar automatically.

## 7. Notifications (Web Push)

90. Push notifications require explicit browser permission and a service-worker subscription.
91. Morning briefing — today's job count, planned time, and the first job to start with.
92. Weekly look-ahead — replaces the morning briefing once a week, summarizing the week's load and heaviest day.
93. Deadline alert — jobs due tomorrow.
94. Inactivity nudge — sent only if nothing was added or touched that day.
95. Unfinished-run reminder — sent once, roughly two hours after a focus session was left open.
96. Streak-milestone notification — sent when a new streak threshold is crossed, includes the XP bonus earned.
97. Calendar-block-starting notification — sent when a mapped Google Calendar block begins.
98. Every notification type has its own on/off toggle and, where relevant, a configurable send time.
99. A single hourly cron job evaluates all notification types for all subscribed users; the calendar-sync job runs separately every 15 minutes.

## 8. Focus Run (Active Session)

100. Starting a run launches a full-screen timer with the day's (or active block's) planned job queue.
101. Live XP-so-far and elapsed time are shown throughout the run.
102. Checking off a job marks it complete and unlocks any jobs that depended on it.
103. Un-checking a completed job reverts it and claws back its XP.
104. Marking a partially-done job opens a dialog to log a new remaining-time estimate instead of completing it.
105. Ending a run ("Finish Run") saves the session and logs a completed/partial/skipped outcome per planned job.
106. "End without saving" discards the run entirely.
107. Leaving a run open triggers the unfinished-session reminder notification later.
108. Reopening the app with an unfinished session prompts to continue it or start fresh.

## 9. Quick Capture

109. A bottom-sheet accessible from anywhere via the tab bar's center button or a PWA home-screen shortcut.
110. Accepts typed text or a voice recording.
111. Voice recordings are transcribed via OpenAI Whisper and inserted into the text field.
112. A live amplitude-reactive animation rings the mic button while recording, driven by real-time audio analysis.
113. Submitted text is routed through the same AI assistant endpoint used by full chat.
114. If the assistant can act immediately with no confirmation needed, the sheet closes with a success toast.
115. Otherwise it hands off to the full Chat screen so the user can confirm or continue the conversation.

## 10. Credits & Billing

116. A monthly free credit allowance (300/month) resets automatically after 30 days.
117. Purchased credits never expire and are used only after free credits run out.
118. Credit-metered actions: AI chat replies, thinking-mode replies, file analysis, bulk job creation, mission-from-file creation, AI avatar generation, web research, AI session planning, voice transcription.
119. Credit deduction is an atomic database operation; a failed AI call refunds the credit automatically.
120. A low-balance warning appears once remaining credits drop below 20%.
121. One-time credit packs and a recurring Pro subscription are both modeled via Stripe products.
122. A Pro subscription multiplies the monthly free allowance and is reflected as a badge on Profile.
123. Stripe webhooks handle purchase completion, subscription renewal, and subscription cancellation.
124. Checkout and billing-portal purchase flows exist end-to-end but are currently hidden behind a "Coming Soon" state in the UI.

## 11. Auth & Onboarding

125. Email/password login and signup via Supabase Auth, with an email-confirmation step on signup.
126. "Continue with Google" sign-in is implemented but currently disabled in the UI.
127. First login/signup provisions a `users` row and an initial credits row automatically.
128. A background self-healing check re-provisions those rows on any page load if they're ever missing.
129. Onboarding is a 4-screen, no-input intro (guide, missions, leveling, focus) shown once, tracked via local storage.
130. Skipping onboarding is always available and has the same effect as completing it.

## 12. PWA & Technical Infrastructure

131. Installable as a home-screen app with a custom manifest, icons, and a "Quick capture" launch shortcut.
132. A service worker precaches app assets for offline use and is only active in production builds.
133. The service worker also handles incoming push events and notification-click deep-linking.
134. Avatar images (profile and mission) can be uploaded, cropped, or AI-generated.
135. A parallel `/v1` route tree preserves the entire pre-redesign app untouched as a rollback reference.
136. All scheduled jobs (reminders, calendar sync) run via Postgres `pg_cron`, not a platform cron service.
137. Row-level security in Postgres scopes every user's data to themselves at the database layer.

## 13. Key User Flows

138. **Daily planning flow**: open Home → auto-planned job queue appears, scoped to the daily budget or an active calendar block → tap Start Run → work through jobs → Finish Run logs results and updates streak/XP.
139. **Quick capture flow**: tap the capture button anywhere → speak or type → AI parses intent → job/mission created immediately, or a confirmation/preview is shown first for anything destructive or a new mission.
140. **Mission lifecycle flow**: create a mission (name, difficulty, color) → add jobs/objectives inside it → complete jobs over time, earning XP → complete the last job to trigger the mission-complete celebration and bonus XP.
141. **Calendar-driven flow**: connect Google Calendar → TimeBud creates a dedicated calendar → user time-blocks a mission on it → TimeBud detects the block, asks once which mission(s) it's for → on every future occurrence, a notification fires and Home auto-scopes to that block.
142. **AI-assisted flow**: ask the assistant (chat or capture) to create/edit/delete jobs or missions in natural language → destructive or mission-creation actions pause for one-tap confirmation → everything else executes immediately and is reflected across the app.
143. **Gamification feedback loop**: complete jobs → earn XP scaled by difficulty → level up and unlock badges → maintain a daily streak → cross streak milestones for bonus XP and a notification.
144. **Notification-to-action flow**: a push notification (morning briefing, deadline, streak, calendar block) deep-links directly into the relevant screen already in the right state.
