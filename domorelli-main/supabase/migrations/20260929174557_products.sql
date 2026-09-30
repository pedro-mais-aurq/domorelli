-- Projeto dedicado: TODOS os usuários de Auth são administradores.
-- Desabilitar cadastro público e login anônimo antes de publicar.
create table public.products (
 id bigint generated always as identity primary key,
 name text not null check (length(trim(name)) > 0),
 description text,
 category text not null check (length(trim(category)) > 0),
 price_cents integer check (price_cents >= 0), -- NULL = Sob consulta, preservado do HTML
 image_path text check (image_path is null or image_path ~ '^products/[0-9]+/[a-zA-Z0-9-]+\.(jpg|png|webp)$'),
 featured boolean not null default false,
 position integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create function public.touch_product_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger products_updated before update on public.products
for each row execute function public.touch_product_updated_at();
alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant usage, select on sequence public.products_id_seq to authenticated;
create policy products_read on public.products for select to anon, authenticated using (true);
-- Anonymous Auth users also carry authenticated; explicitly reject them.
create policy products_insert on public.products for insert to authenticated
with check ((select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
create policy products_update on public.products for update to authenticated
using ((select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false))
with check ((select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
create policy products_delete on public.products for delete to authenticated
using ((select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy product_images_read on storage.objects for select to anon, authenticated
using (bucket_id = 'product-images');
create policy product_images_insert on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and name ~ '^products/[0-9]+/[a-zA-Z0-9-]+\.(jpg|png|webp)$'
and (select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)
and exists(select 1 from public.products p where p.id::text = (storage.foldername(storage.objects.name))[2]));
create policy product_images_update on storage.objects for update to authenticated
using (bucket_id = 'product-images' and (select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false))
with check (bucket_id = 'product-images' and name ~ '^products/[0-9]+/[a-zA-Z0-9-]+\.(jpg|png|webp)$'
and (select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
create policy product_images_delete on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and (select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,false));
