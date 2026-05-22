-- 0015: Storage RLS for the public car-photos bucket. Reads are public (bucket
-- is public); writes/deletes are restricted to the owner of the car whose id is
-- the first path segment (car-photos/<car_id>/<file>). Matches the app's
-- client-side + RLS pattern (uploads go straight from the owner's browser).

create policy "car_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'car-photos');

create policy "car_photos_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'car-photos'
    and exists (
      select 1 from public.cars c
      where c.id::text = (storage.foldername(name))[1]
        and c.owner_id = auth.uid()
    )
  );

create policy "car_photos_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'car-photos'
    and exists (
      select 1 from public.cars c
      where c.id::text = (storage.foldername(name))[1]
        and c.owner_id = auth.uid()
    )
  );
