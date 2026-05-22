-- 0014: car photos. Owners attach photos to a car; they're shown on the no-login
-- /act offer page and can be forwarded to the requester's WhatsApp (to share with
-- their customer). Public bucket so WAHA and the page can load the images by URL.

alter table public.cars add column if not exists photo_urls text[] not null default '{}';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('car-photos', 'car-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
