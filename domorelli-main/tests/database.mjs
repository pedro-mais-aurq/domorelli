import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
// Supabase-owned schemas/functions are represented locally; no remote project is changed.
await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id bigint generated always as identity,name text,bucket_id text);
alter table storage.objects enable row level security;
grant usage on schema public,auth,storage to anon,authenticated;
grant all on storage.objects to anon,authenticated;
grant usage,select on sequence storage.objects_id_seq to anon,authenticated;`);
await db.exec(readFileSync('supabase/migrations/'+readdirSync('supabase/migrations')[0],'utf8'));
const seed=readFileSync('supabase/menu-seed.sql','utf8');await db.exec(seed);
assert.equal((await db.query('select count(*)::int n from products')).rows[0].n,210);
try{await db.exec(seed);assert.fail('Seed repeated');}catch(e){assert.match(e.message,/não está vazia/);await db.exec('rollback');}
await db.exec('set role anon');
assert.equal((await db.query('select count(*)::int n from products')).rows[0].n,210);
for(const sql of ["insert into products(name,category) values('x','x')","update products set name='x'","delete from products","insert into storage.objects(name,bucket_id) values('products/1/x.jpg','product-images')"]){await assert.rejects(db.exec(sql));}
await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false); select set_config('request.jwt.claims','{"is_anonymous":false}',false);`);
const row=(await db.query("insert into products(name,category,price_cents) values('Teste','Entradas',1234) returning *")).rows[0];
await db.exec(`update products set price_cents=2500 where id=${row.id};insert into storage.objects(name,bucket_id) values('products/${row.id}/test.jpg','product-images');update storage.objects set name='products/${row.id}/new.png';delete from storage.objects;delete from products where id=${row.id};`);
await assert.rejects(db.exec("insert into products(name,category,price_cents) values('x','x',-1)"));
await db.exec(`select set_config('request.jwt.claims','{"is_anonymous":true}',false);`);
await assert.rejects(db.exec("insert into products(name,category) values('x','x')"));
await assert.rejects(db.exec("insert into storage.objects(name,bucket_id) values('products/1/x.jpg','product-images')"));
console.log('PASS: migration; 210 rows; repeat guard; anon denial; authenticated CRUD/Storage; anonymous Auth denial; negative price.');
await db.close();
