create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'visitor' check (role in ('student', 'visitor', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles alter column role set default 'visitor';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'visitor', 'admin'));

create table if not exists public.schools (
  id text primary key,
  name text not null
);

insert into public.schools (id, name) values
  ('bella-vista', 'Escola Estadual do Bella Vista'),
  ('ceep', 'Centro Estadual de Educação Profissional Ozório Gonçalves Nogueira')
on conflict (id) do update set name = excluded.name;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(id),
  author_id uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 120),
  summary text not null check (char_length(summary) between 1 and 220),
  body text not null check (char_length(body) between 1 and 5000),
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.project_proposals (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(id),
  author_id uuid not null references public.profiles(id),
  target_project_id uuid references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  summary text not null check (char_length(summary) between 1 and 220),
  body text not null check (char_length(body) between 1 and 5000),
  image_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create or replace function public.is_project_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.is_project_student()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'student'
  );
$$;

create or replace function public.create_project_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when lower(split_part(coalesce(new.email, ''), '@', 2)) = 'escola.pr.gov.br'
      then 'student' else 'visitor' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_project_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = new.email,
      role = case
        when role = 'admin' then 'admin'
        when lower(split_part(coalesce(new.email, ''), '@', 2)) = 'escola.pr.gov.br' then 'student'
        else 'visitor'
      end
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated_project_profile on auth.users;
create trigger on_auth_user_email_updated_project_profile
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute procedure public.sync_project_profile_email();

drop trigger if exists on_auth_user_created_project_profile on auth.users;
create trigger on_auth_user_created_project_profile
  after insert on auth.users
  for each row execute procedure public.create_project_profile();

update public.profiles profile
set email = auth_user.email,
    role = case
      when profile.role = 'admin' then 'admin'
      when lower(split_part(coalesce(auth_user.email, ''), '@', 2)) = 'escola.pr.gov.br' then 'student'
      else 'visitor'
    end
from auth.users auth_user
where auth_user.id = profile.id;

create or replace function public.review_project_proposal(p_proposal_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal public.project_proposals%rowtype;
begin
  if not public.is_project_admin() then
    raise exception 'Apenas o administrador pode revisar propostas';
  end if;

  select * into proposal
  from public.project_proposals
  where id = p_proposal_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Proposta não encontrada ou já revisada';
  end if;

  if p_approve then
    if proposal.target_project_id is null then
      insert into public.projects (school_id, author_id, title, summary, body, image_url)
      values (proposal.school_id, proposal.author_id, proposal.title, proposal.summary, proposal.body, proposal.image_url);
    else
      if not exists (
        select 1 from public.projects
        where id = proposal.target_project_id and author_id = proposal.author_id
      ) then
        raise exception 'O estudante só pode propor alterações nos próprios projetos';
      end if;
      update public.projects
      set school_id = proposal.school_id,
          title = proposal.title,
          summary = proposal.summary,
          body = proposal.body,
          image_url = proposal.image_url
      where id = proposal.target_project_id;
    end if;
  end if;

  update public.project_proposals
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_at = now()
  where id = p_proposal_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.projects enable row level security;
alter table public.project_proposals enable row level security;

drop policy if exists "Profiles are visible to their owner or admin" on public.profiles;
create policy "Profiles are visible to their owner or admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_project_admin()));

drop policy if exists "Schools are public" on public.schools;
create policy "Schools are public"
  on public.schools for select to anon, authenticated using (true);

drop policy if exists "Published projects are public" on public.projects;
create policy "Published projects are public"
  on public.projects for select to anon, authenticated using (true);
drop policy if exists "Admins manage published projects" on public.projects;
create policy "Admins manage published projects"
  on public.projects for all to authenticated
  using ((select public.is_project_admin()))
  with check ((select public.is_project_admin()));

drop policy if exists "Authors and admins read proposals" on public.project_proposals;
create policy "Authors and admins read proposals"
  on public.project_proposals for select to authenticated
  using (author_id = (select auth.uid()) or (select public.is_project_admin()));
drop policy if exists "Students submit pending proposals" on public.project_proposals;
create policy "Students submit pending proposals"
  on public.project_proposals for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'pending'
    and (select public.is_project_student())
  );
drop policy if exists "Authors edit their pending proposals" on public.project_proposals;
create policy "Authors edit their pending proposals"
  on public.project_proposals for update to authenticated
  using (author_id = (select auth.uid()) and status = 'pending' and (select public.is_project_student()))
  with check (author_id = (select auth.uid()) and status = 'pending' and (select public.is_project_student()));
drop policy if exists "Admins manage proposals" on public.project_proposals;
create policy "Admins manage proposals"
  on public.project_proposals for all to authenticated
  using ((select public.is_project_admin()))
  with check ((select public.is_project_admin()));

grant usage on schema public to anon, authenticated;
grant select on public.schools, public.projects to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.project_proposals to authenticated;
grant insert, update, delete on public.projects to authenticated;
grant execute on function public.is_project_admin() to authenticated;
grant execute on function public.is_project_student() to authenticated;
revoke all on function public.review_project_proposal(uuid, boolean) from public;
grant execute on function public.review_project_proposal(uuid, boolean) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-images', 'project-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Students and admins upload project images" on storage.objects;
create policy "Students and admins upload project images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and ((select public.is_project_student()) or (select public.is_project_admin()))
  );

drop policy if exists "Owners and admins delete project images" on storage.objects;
create policy "Owners and admins delete project images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and ((select public.is_project_student()) or (select public.is_project_admin()))
  );

update public.profiles
set role = 'admin'
where lower(email) = 'rafael.emidio.oliveira@escola.pr.gov.br';
