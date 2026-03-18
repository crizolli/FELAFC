create extension if not exists pgcrypto;

create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  summary text not null,
  content text not null,
  published_date date not null,
  time_label text not null default 'Sem horario informado',
  ratings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_news_articles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists news_articles_set_updated_at on public.news_articles;

create trigger news_articles_set_updated_at
before update on public.news_articles
for each row
execute function public.set_news_articles_updated_at();

alter table public.news_articles enable row level security;

drop policy if exists "Public can read news" on public.news_articles;
create policy "Public can read news"
on public.news_articles
for select
to public
using (true);

drop policy if exists "Authenticated users can insert news" on public.news_articles;
create policy "Authenticated users can insert news"
on public.news_articles
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update news" on public.news_articles;
create policy "Authenticated users can update news"
on public.news_articles
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete news" on public.news_articles;
create policy "Authenticated users can delete news"
on public.news_articles
for delete
to authenticated
using (true);

create table if not exists public.media_videos (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text not null default '',
  published_date date not null default current_date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.media_videos
add column if not exists published_date date not null default current_date;

create or replace function public.set_media_videos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists media_videos_set_updated_at on public.media_videos;

create trigger media_videos_set_updated_at
before update on public.media_videos
for each row
execute function public.set_media_videos_updated_at();

alter table public.media_videos enable row level security;

drop policy if exists "Public can read media" on public.media_videos;
create policy "Public can read media"
on public.media_videos
for select
to public
using (true);

drop policy if exists "Authenticated users can insert media" on public.media_videos;
create policy "Authenticated users can insert media"
on public.media_videos
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update media" on public.media_videos;
create policy "Authenticated users can update media"
on public.media_videos
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete media" on public.media_videos;
create policy "Authenticated users can delete media"
on public.media_videos
for delete
to authenticated
using (true);
