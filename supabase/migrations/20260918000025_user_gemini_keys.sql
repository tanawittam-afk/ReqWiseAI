-- ReqWiseAI — Phase 1, Slice 3: encrypted own-Gemini-key storage
--
-- Slice 1 gave every user a shared daily analysis limit. This slice lets a user store
-- their OWN Gemini API key so their runs bypass that shared limit entirely — the limit
-- exists to cap what the app itself pays for, not what a user pays for out of their own
-- account.
--
-- WHY A NEW TABLE, one row per user: this is exactly the shape user_daily_usage already
-- argued for (a durable, one-row-per-user secret vs. a disposable one-row-per-day
-- counter) except the lifecycle here is "at most one key per user, replaced in place" —
-- a primary key on user_id, no separate id column, no history. Nothing about a
-- superseded key is worth keeping once it is overwritten.
--
-- WHY CIPHERTEXT/IV/AUTH_TAG AS SEPARATE COLUMNS, not one opaque blob: AES-256-GCM
-- needs all three to decrypt, and storing them apart (rather than concatenated and
-- re-split in application code) is the more honest schema — a reader of this table
-- immediately sees an authenticated cipher is in use, not "some bytes".
--
-- WHY NO CLIENT SELECT/INSERT/UPDATE/DELETE POLICY AT ALL, not even a self-select like
-- user_daily_usage's: that table's row is safe to read directly (a spend counter);
-- this one holds encrypted key material. There is no reason for a raw row ever to leave
-- the database — even encrypted — when the app only ever needs a yes/no status or the
-- decrypted key material for its own immediate use. Every access goes through the four
-- SECURITY DEFINER RPCs below, same discipline as change_requests.
--
-- WHY THE DECRYPT-CAPABLE RPC (get_my_gemini_key_material) SHIPS SEPARATELY FROM THE
-- STATUS RPC (get_my_gemini_key_status): a settings page that only wants to render
-- "•••• 7f3a, updated Jan 3" should never be one bug away from also handing back
-- ciphertext. The material RPC exists purely for the server-side analysis path to call
-- right before decrypting, on the user's own client (never the service role).
--
-- The Node-side encryption/decryption key and the AES implementation are entirely
-- outside the database's concern — lib/security/gemini-key-crypto.ts owns that. This
-- table only ever sees base64 text in and base64 text out (via encode/decode), never a
-- plaintext key.
--
-- The /admin page and the app_settings table (Slice 4) are a separate, later piece of
-- work and are deliberately not touched here.

create table user_gemini_keys (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  ciphertext   bytea not null,
  iv           bytea not null,
  auth_tag     bytea not null,
  last_four    text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table user_gemini_keys enable row level security;

-- No select/insert/update/delete policy for any client role, on purpose — see the
-- header comment. Every access goes only through the RPCs below.

-- ---------------------------------------------------------------------------
-- get_my_gemini_key_status — the settings-page door. Never returns key material,
-- only whether one exists and the display-safe hint (last_four, updated_at).
-- ---------------------------------------------------------------------------
create or replace function get_my_gemini_key_status()
returns table(has_key boolean, last_four text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row  user_gemini_keys%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row from user_gemini_keys where user_id = v_user;

  if v_row.user_id is null then
    return query select false, null::text, null::timestamptz;
  else
    return query select true, v_row.last_four, v_row.updated_at;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_my_gemini_key_material — the analysis-path door. Returns the ciphertext, iv and
-- auth tag base64-encoded as text (via encode(..., 'base64')), not raw bytea — a bytea
-- column serialized through PostgREST/RPC JSON comes back Postgres's own hex text
-- format ("\x..."), not base64, which would silently mismatch
-- lib/security/gemini-key-crypto.ts's base64 contract. Encoding here, once, in the one
-- place that knows the storage format, avoids that foot-gun entirely.
--
-- Returns zero rows when no key is saved — the caller (lib/analysis/own-gemini-key.ts)
-- reads that as "fall through to the shared daily limit", exactly like
-- get_my_gemini_key_status()'s has_key = false.
-- ---------------------------------------------------------------------------
create or replace function get_my_gemini_key_material()
returns table(ciphertext text, iv text, auth_tag text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;

  return query
    select encode(k.ciphertext, 'base64'), encode(k.iv, 'base64'), encode(k.auth_tag, 'base64')
    from user_gemini_keys k
    where k.user_id = v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_my_gemini_key — the write door. Upserts, so "add a key" and "replace a key" are
-- the same call — there is never a meaningful distinction between the two states for a
-- single-row-per-user table. Ciphertext/iv/auth_tag arrive as base64 text (matching
-- what get_my_gemini_key_material returns) and are decoded back to bytea for storage.
-- ---------------------------------------------------------------------------
create or replace function save_my_gemini_key(
  p_ciphertext text,
  p_iv         text,
  p_auth_tag   text,
  p_last_four  text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;

  if p_ciphertext is null or p_iv is null or p_auth_tag is null
     or btrim(p_ciphertext) = '' or btrim(p_iv) = '' or btrim(p_auth_tag) = '' then
    raise exception 'key material is incomplete' using errcode = 'check_violation';
  end if;

  if p_last_four is null or char_length(btrim(p_last_four)) = 0 then
    raise exception 'a display hint is required' using errcode = 'check_violation';
  end if;

  insert into user_gemini_keys (user_id, ciphertext, iv, auth_tag, last_four, updated_at)
    values (
      v_user,
      decode(p_ciphertext, 'base64'),
      decode(p_iv, 'base64'),
      decode(p_auth_tag, 'base64'),
      p_last_four,
      now()
    )
  on conflict (user_id) do update
    set ciphertext = excluded.ciphertext,
        iv         = excluded.iv,
        auth_tag   = excluded.auth_tag,
        last_four  = excluded.last_four,
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_my_gemini_key — the removal door. Silently a no-op if nothing is saved,
-- matching decrement_daily_usage()'s "acting on your own row that may not exist is
-- never an error" shape.
-- ---------------------------------------------------------------------------
create or replace function delete_my_gemini_key()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;

  delete from user_gemini_keys where user_id = v_user;
end;
$$;

revoke execute on function get_my_gemini_key_status() from public;
grant execute on function get_my_gemini_key_status() to authenticated;

revoke execute on function get_my_gemini_key_material() from public;
grant execute on function get_my_gemini_key_material() to authenticated;

revoke execute on function save_my_gemini_key(text, text, text, text) from public;
grant execute on function save_my_gemini_key(text, text, text, text) to authenticated;

revoke execute on function delete_my_gemini_key() from public;
grant execute on function delete_my_gemini_key() to authenticated;
