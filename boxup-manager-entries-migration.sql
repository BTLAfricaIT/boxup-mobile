-- Lets admins/managers add entries (sales, visits, events) from the mobile app.
-- Additive: permissive policies OR with existing ones, so agent rules are unchanged.

drop policy if exists "btl_sales_manager_insert" on public.btl_sales;
create policy "btl_sales_manager_insert" on public.btl_sales
  for insert to authenticated
  with check (public.btl_is_manager() or public.is_admin());

drop policy if exists "btl_visits_manager_insert" on public.btl_visits;
create policy "btl_visits_manager_insert" on public.btl_visits
  for insert to authenticated
  with check (public.btl_is_manager() or public.is_admin());

drop policy if exists "btl_activations_manager_insert" on public.btl_activations;
create policy "btl_activations_manager_insert" on public.btl_activations
  for insert to authenticated
  with check (public.btl_is_manager() or public.is_admin());
