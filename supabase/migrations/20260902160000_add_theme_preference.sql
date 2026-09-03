-- User's manual theme choice — 'system' follows the OS preference live via CSS,
-- 'dark' is the default so every existing user's experience is unchanged until they
-- opt in to something else.
alter table user_ai_settings
  add column if not exists theme_preference text not null default 'dark'
  check (theme_preference in ('dark', 'light', 'system'));
