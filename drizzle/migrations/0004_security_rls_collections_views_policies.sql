-- 1. Collections + collection_products: enable RLS with public read / admin write
GRANT SELECT ON public.collections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;

GRANT SELECT ON public.collection_products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.collection_products TO authenticated;
GRANT ALL ON public.collection_products TO service_role;

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collections public read active" ON public.collections;
CREATE POLICY "collections public read active" ON public.collections
  FOR SELECT TO anon, authenticated
  USING (active IS TRUE);

DROP POLICY IF EXISTS "collections staff read all" ON public.collections;
CREATE POLICY "collections staff read all" ON public.collections
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "collections admin write" ON public.collections;
CREATE POLICY "collections admin write" ON public.collections
  FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

DROP POLICY IF EXISTS "collection_products public read active" ON public.collection_products;
CREATE POLICY "collection_products public read active" ON public.collection_products
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = collection_products.collection_id AND c.active IS TRUE
  ));

DROP POLICY IF EXISTS "collection_products staff read all" ON public.collection_products;
CREATE POLICY "collection_products staff read all" ON public.collection_products
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "collection_products admin write" ON public.collection_products;
CREATE POLICY "collection_products admin write" ON public.collection_products
  FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

-- 2. Security definer view -> invoker, staff only
ALTER VIEW public.courier_performance_stats SET (security_invoker = on);
REVOKE ALL ON public.courier_performance_stats FROM anon;
GRANT SELECT ON public.courier_performance_stats TO authenticated;
GRANT ALL ON public.courier_performance_stats TO service_role;

-- 3. Branches: remove write policy scoped to public role (duplicate of authenticated policy)
DROP POLICY IF EXISTS "Admins can manage branches" ON public.branches;

-- 4. Wallet transactions: direct ownership check instead of self-join
DROP POLICY IF EXISTS "Customer view own wallet tx" ON public.wallet_transactions;
CREATE POLICY "Customer view own wallet tx" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (wallet_id = auth.uid());

-- 5. Loyalty accounts: let a customer read only their own record (matched by their profile phone)
DROP POLICY IF EXISTS "loyalty read own by phone" ON public.loyalty_accounts;
CREATE POLICY "loyalty read own by phone" ON public.loyalty_accounts
  FOR SELECT TO authenticated
  USING (
    phone IS NOT NULL AND phone <> '' AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.phone IS NOT NULL
        AND regexp_replace(p.phone, '\D', '', 'g') <> ''
        AND right(regexp_replace(p.phone, '\D', '', 'g'), 10) = right(regexp_replace(loyalty_accounts.phone, '\D', '', 'g'), 10)
    )
  );
