-- Admin-defined application requirements: sections of fields per visa type.
--
-- visa_types.application_sections replaces the flat application_questions
-- list. Each section is answered once per application (answers in
-- visa_applications.custom_answers, keyed by section) or once per traveller
-- (answers in visa_members.details -> 'answers', keyed by section). File
-- fields are visa_documents rows with document_type '<section>.<field>'.
--
-- application_questions is left in place, unused, so nothing reading an old
-- snapshot breaks. No RLS changes: the new column inherits the row policies.

alter table public.visa_types
  add column if not exists application_sections jsonb not null default '[]'::jsonb;

-- Existing questions become one application-scope section.
update public.visa_types vt
   set application_sections = jsonb_build_array(
         jsonb_build_object(
           'key', 'additional_questions',
           'title', 'Additional questions',
           'scope', 'application',
           'fields', (
             select coalesce(jsonb_agg(
                      jsonb_strip_nulls(jsonb_build_object(
                        'key', q->>'key',
                        'label', q->>'label',
                        'type', case q->>'type'
                                  when 'yesno' then 'yes_no'
                                  when 'select' then 'dropdown'
                                  else 'short_text'
                                end,
                        'required', coalesce((q->>'required')::boolean, true),
                        'options', case when jsonb_typeof(q->'options') = 'array' then q->'options' end
                      ))
                      order by ord), '[]'::jsonb)
               from jsonb_array_elements(vt.application_questions) with ordinality as e(q, ord)
              where jsonb_typeof(q) = 'object' and q ? 'key' and q ? 'label'
           )
         )
       )
 where jsonb_typeof(vt.application_questions) = 'array'
   and jsonb_array_length(vt.application_questions) > 0
   and vt.application_sections = '[]'::jsonb;

-- Existing flat answers ({ key: value }) move under that section.
update public.visa_applications
   set custom_answers = jsonb_build_object('additional_questions', custom_answers)
 where jsonb_typeof(custom_answers) = 'object'
   and custom_answers <> '{}'::jsonb
   and not custom_answers ? 'additional_questions'
   and not exists (
     select 1 from jsonb_each(custom_answers) e where jsonb_typeof(e.value) = 'object'
   );
