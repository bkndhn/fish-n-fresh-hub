export type Product = {
  id: string;
  name: string;
  name_tamil: string | null;
  description: string | null;
  price: number;
  old_price: number | null;
  unit: string;
  category: string | null;
  image_url: string | null;
  stock: number;
  is_available: boolean;
  origin: string | null;
  rating: number;
  is_featured: boolean;
  tags: string[] | null;
  calories: number | null;
  protein: string | null;
  best_for: string | null;
  benefits: string[] | null;
  storage: string | null;
  source_origin: string | null;
  lab_tested: boolean;
  traceability: string | null;
  recipe_title: string | null;
  recipe_steps: string | null;
};

export type Category = {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  icon: string | null;
  sort_order: number;
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link: string | null;
  cta: string | null;
  active: boolean;
  sort_order: number;
};

export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  unit: string;
  image_url: string | null;
  qty: number;
};
