-- Bucket configuration is supported SQL. Application uploads/deletions must
-- use the Storage API, never direct mutations of storage.objects metadata.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('professional-documents', 'professional-documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png']);

create policy professional_documents_read on storage.objects
for select to authenticated using (
  bucket_id = 'professional-documents' and
  (private.is_admin() or
   (private.has_role('professional') and (storage.foldername(name))[1] = auth.uid()::text))
);
create policy professional_documents_upload on storage.objects
for insert to authenticated with check (
  bucket_id = 'professional-documents' and private.has_role('professional') and
  (storage.foldername(name))[1] = auth.uid()::text and
  name ~ ('^' || auth.uid()::text ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png)$')
);
create policy professional_documents_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'professional-documents' and
  (private.is_admin() or
   (private.has_role('professional') and (storage.foldername(name))[1] = auth.uid()::text))
);
-- No UPDATE policy: immutable UUID-named uploads, no overwrite/upsert.
-- No public media bucket or unreviewed public image upload path in Phase 3A.

-- Production-safe initial content from src/content/services.ts. Publication
-- means visible information, never guaranteed booking availability.
insert into public.service_categories(name, slug, description, display_order) values
  ('Yoga', 'yoga', 'Personal yoga practice at home.', 1),
  ('Naturopathy', 'naturopathy', 'Lifestyle and wellness consultations.', 2),
  ('Massage and Wellness Therapy', 'massage-wellness', 'Rest and relaxation at home.', 3);

insert into public.services(category_id, name, slug, short_description, is_published, display_order)
select c.id, v.name, v.slug, v.description, true, v.display_order
from (values
  ('yoga', 'Personal Yoga Training', 'personal-yoga',
   'One-to-one yoga practice at home, shaped around your experience, preferences, and personal goals.', 1),
  ('naturopathy', 'Naturopathy Consultations', 'naturopathy',
   'Personal consultations to discuss your lifestyle, everyday habits, and wellness goals with a suitable professional.', 2),
  ('massage-wellness', 'Massage & Wellness Therapy', 'massage-therapy',
   'At-home sessions focused on relaxation and personal comfort, with the service and visit requirements explained beforehand.', 3)
) as v(category_slug, name, slug, description, display_order)
join public.service_categories c on c.slug = v.category_slug;
-- Prices and durations remain NULL. No professionals, accounts, areas, or
-- monthly package definitions are seeded into the business environment.
