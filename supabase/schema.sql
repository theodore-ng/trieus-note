-- Chạy một lần trong Supabase: SQL Editor -> New query -> dán toàn bộ -> Run.

-- Danh mục của mỗi người dùng (1 dòng / người), lưu dạng JSON.
create table if not exists public.portfolios (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Hồ sơ: tên đăng nhập và vai trò (admin quản lý tài khoản).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

-- Row Level Security: mỗi người chỉ đọc/ghi dữ liệu của chính mình.
alter table public.portfolios enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "portfolio_select_own" on public.portfolios;
drop policy if exists "portfolio_insert_own" on public.portfolios;
drop policy if exists "portfolio_update_own" on public.portfolios;
create policy "portfolio_select_own" on public.portfolios for select using (auth.uid() = user_id);
create policy "portfolio_insert_own" on public.portfolios for insert with check (auth.uid() = user_id);
create policy "portfolio_update_own" on public.portfolios for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Người dùng chỉ đọc hồ sơ của mình; không ai tự đổi vai trò qua API (chỉ sửa trong dashboard/SQL).
drop policy if exists "profile_select_own" on public.profiles;
create policy "profile_select_own" on public.profiles for select using (auth.uid() = id);

-- Gán quyền admin (chạy SAU khi đã tạo user trong Authentication -> Users), thay <ten> bằng tên đăng nhập:
-- insert into public.profiles (id, username, role)
-- select id, '<ten>', 'admin' from auth.users where email = '<ten>@quyvang.app'
-- on conflict (id) do update set role = 'admin', username = excluded.username;

-- ===== Trieu's Note › Ghi chú (thêm 11/2026, chạy được nhiều lần) =====
create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  body text not null default '',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_updated on public.notes (user_id, updated_at desc);
alter table public.notes enable row level security;

drop policy if exists "notes_select_own" on public.notes;
drop policy if exists "notes_insert_own" on public.notes;
drop policy if exists "notes_update_own" on public.notes;
drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_select_own" on public.notes for select using (auth.uid() = user_id);
create policy "notes_insert_own" on public.notes for insert with check (auth.uid() = user_id);
create policy "notes_update_own" on public.notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_delete_own" on public.notes for delete using (auth.uid() = user_id);
