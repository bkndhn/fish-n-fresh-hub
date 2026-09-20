const fs = require('fs');

const path = 'src/integrations/supabase/types.ts';
let types = fs.readFileSync(path, 'utf8');

const collectionsDef = `      collections: {
        Row: {
          id: string
          name: string
          active: boolean
          sort_order: number
          branch_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          active?: boolean
          sort_order?: number
          branch_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          active?: boolean
          sort_order?: number
          branch_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          }
        ]
      }
      collection_products: {
        Row: {
          collection_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          collection_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          collection_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }`;

if (!types.includes('collections: {')) {
  types = types.replace('public: {\n    Tables: {', 'public: {\n    Tables: {\n' + collectionsDef);
  fs.writeFileSync(path, types);
  console.log("Injected collections");
} else {
  console.log("Already present");
}
