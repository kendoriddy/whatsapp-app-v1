-- Inbound WhatsApp media: original filename + private storage bucket

alter table media_asset
  add column if not exists original_filename text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wa-media',
  'wa-media',
  false,
  104857600,
  null
)
on conflict (id) do update set public = false;
