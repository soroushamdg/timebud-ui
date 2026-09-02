-- Persisted, server-side chat history for Bud. Previously conversation history lived
-- only in the browser (localStorage, capped at the last 40 messages, no summarization,
-- nothing survived across devices or was ever provably "what actually happened"). These
-- tables become the durable source of truth: every turn's text, plus which tools ran
-- and their results as an audit trail, with a rolling summary so old turns collapse
-- instead of being resent unboundedly (or silently falling out of the local cap).
--
-- One conversation per user (the chat UI is a single continuous thread, not
-- multi-conversation) — the app finds-or-creates it rather than the user picking one.

create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text,
  summary_token_count int not null default 0,
  summarized_message_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table chat_conversations enable row level security;
create policy "manage own conversations" on chat_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_chat_conversations_user
  on chat_conversations (user_id, created_at desc);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  tool_calls jsonb,
  tool_results jsonb,
  created_at timestamptz not null default now()
);
alter table chat_messages enable row level security;
-- Only the server (service-role client, bypasses RLS) writes turns — this policy is
-- only for a future "view your history" read surface, not day-to-day chat traffic.
create policy "select own messages" on chat_messages
  for select using (
    exists (select 1 from chat_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );

create index if not exists idx_chat_messages_conversation_time
  on chat_messages (conversation_id, created_at);
