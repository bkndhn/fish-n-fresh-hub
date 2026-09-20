import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(url, key);

async function main() {
  const sql = `
  CREATE TABLE IF NOT EXISTS public.collections (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS public.collection_products (
    collection_id uuid REFERENCES public.collections(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    sort_order integer DEFAULT 0,
    PRIMARY KEY(collection_id, product_id)
  );
  
  ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;
  
  CREATE POLICY "Public collections" ON public.collections FOR SELECT USING (true);
  CREATE POLICY "Admin collections" ON public.collections USING (true);
  CREATE POLICY "Public collection_products" ON public.collection_products FOR SELECT USING (true);
  CREATE POLICY "Admin collection_products" ON public.collection_products USING (true);
  `;
  
  const { data, error } = await supabase.rpc("execute_sql", { sql });
  console.log(error || "Success");
}
main();
