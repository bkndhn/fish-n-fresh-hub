-- 1. Enable Realtime on products and store_settings
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table store_settings;

-- 2. Create the Storage Bucket for images (publicly accessible)
insert into storage.buckets (id, name, public) 
values ('images', 'images', true) 
on conflict (id) do nothing;

-- 3. Setup Storage RLS Policies for the images bucket
create policy "Public Access" 
  on storage.objects for select 
  using ( bucket_id = 'images' );

create policy "Authenticated users can upload images" 
  on storage.objects for insert 
  to authenticated 
  with check ( bucket_id = 'images' );

create policy "Authenticated users can update images" 
  on storage.objects for update 
  to authenticated 
  using ( bucket_id = 'images' );

create policy "Authenticated users can delete images" 
  on storage.objects for delete 
  to authenticated 
  using ( bucket_id = 'images' );
