-- Public trainer photographs use immutable, owner-scoped objects. The database
-- reference remains the only way an uploaded object is attached to a profile.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('public-professional-images','public-professional-images',true,5242880,
  array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy professional_images_public_read on storage.objects
for select to public using(bucket_id='public-professional-images');

create policy professional_images_owner_upload on storage.objects
for insert to authenticated with check(
  bucket_id='public-professional-images' and private.has_role('professional') and
  (storage.foldername(name))[1]=auth.uid()::text and
  name ~ ('^'||auth.uid()::text||'/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$')
);

create policy professional_images_owner_delete_unused on storage.objects
for delete to authenticated using(
  bucket_id='public-professional-images' and private.has_role('professional') and
  (storage.foldername(name))[1]=auth.uid()::text and
  not exists(select 1 from public.professional_profiles p where p.user_id=auth.uid()
    and p.approved_image_reference='public-professional-images/'||storage.objects.name)
);

create function public.set_professional_profile_photo(p_reference text)
returns text language plpgsql volatile security definer set search_path='' as $$
declare old_reference text; object_name text;
begin
  if not private.has_role('professional') then raise exception 'Professional role required' using errcode='42501'; end if;
  if p_reference is not null then
    if p_reference !~ ('^public-professional-images/'||auth.uid()::text||'/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$') then
      raise exception 'Invalid profile photo reference' using errcode='22023';
    end if;
    object_name=substring(p_reference from char_length('public-professional-images/')+1);
    if not exists(select 1 from storage.objects o where o.bucket_id='public-professional-images'
      and o.name=object_name and o.owner_id=auth.uid()::text) then
      raise exception 'Profile photo upload not found' using errcode='P0002';
    end if;
  end if;
  select approved_image_reference into old_reference from public.professional_profiles where user_id=auth.uid() for update;
  if not found then raise exception 'Professional profile not found' using errcode='P0002'; end if;
  update public.professional_profiles set approved_image_reference=p_reference where user_id=auth.uid();
  insert into public.administrative_audit(target_user_id,actor_user_id,action,previous_state,new_state,reason)
    values(auth.uid(),auth.uid(),'publication_change',old_reference,coalesce(p_reference,'removed'),'Professional updated profile photo');
  return old_reference;
end $$;

revoke all on function public.set_professional_profile_photo(text) from public,anon;
grant execute on function public.set_professional_profile_photo(text) to authenticated;
