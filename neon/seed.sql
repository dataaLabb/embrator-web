insert into app_users (email, full_name, password_hash, is_active)
values (
  'admin@embrator.com',
  'Admin User',
  crypt('12345678', gen_salt('bf')),
  true
)
on conflict (email) do update
set full_name = excluded.full_name,
    is_active = excluded.is_active;

insert into portal_settings (key, value)
values
  ('orders_password', '1234'),
  ('dashboard_password', '5678')
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

insert into customers (code, name, rep, category, sector, area, address)
values
  ('C001', 'مؤسسة النور', 'أحمد', 'A', 'تجزئة', 'مدينة نصر', 'القاهرة'),
  ('C002', 'شركة الهدى', 'محمود', 'B', 'جملة', 'المعادي', 'القاهرة')
on conflict (code) do nothing;

insert into items (code, name, model, unit)
values
  ('I001', 'موتور 1 حصان', 'M-100', 'قطعة'),
  ('I002', 'مضخة مياه', 'P-200', 'قطعة')
on conflict (code) do nothing;
