alter table public.activity_labels
  add column major_activity text;

alter table public.activity_labels
  add constraint activity_labels_major_activity_check
  check (
    (is_break = true and (major_activity is null or major_activity = 'breaks'))
    or
    (
      is_break = false
      and (
        major_activity is null
        or major_activity in (
          'research',
          'teaching',
          'administration',
          'outreach'
        )
      )
    )
  );

comment on column public.activity_labels.major_activity is
  'Owner-defined roll-up category for annual activity analytics. Break labels are treated as Breaks automatically; non-break labels may be Research, Teaching, Administration, Outreach, or temporarily unclassified.';
