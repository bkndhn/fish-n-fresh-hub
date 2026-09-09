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
  gst_percent: number;
  gst_included: boolean;
  allow_custom_qty: boolean;
  low_stock_threshold?: number | null;
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
  cut_preference?: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  harbour?: string | null;
  contact_person?: string | null;
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  gstin?: string | null;
  upi_id?: string | null;
  bank_details?: string | null;
  balance_due?: number;
  created_at?: string;
};

export type PurchaseItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number;
  total_cost: number;
};

export type PurchaseOrder = {
  id: string;
  reference_no: string;
  supplier_id: string;
  supplier_name: string;
  supplier_phone: string;
  inward_date: string;
  items: PurchaseItem[];
  total_amount: number;
  paid_amount: number;
  payment_status: "paid" | "partial" | "pending";
  payment_method: "cash" | "upi" | "bank" | "credit";
  notes?: string | null;
  created_at?: string;
};

export type WasteEntry = {
  id: string;
  date: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  reason: "spoilage" | "trimming_loss" | "transit_damage" | "customer_return" | "other";
  cost_loss: number;
  notes?: string | null;
  logged_by?: string | null;
  created_at?: string;
};

export type CustomerWallet = {
  user_id: string;
  balance: number;
  referral_code: string;
  referred_by?: string | null;
  total_earned: number;
  total_redeemed: number;
  created_at?: string;
  updated_at?: string;
};

export type WalletTransaction = {
  id: string;
  wallet_id: string;
  amount: number;
  type: "referral_bonus" | "signup_bonus" | "cashback" | "order_redemption" | "admin_adjustment";
  description: string | null;
  order_id?: string | null;
  created_at: string;
};

export type ProductAiBenefits = {
  id?: string;
  product_id: string;
  product_name: string;
  omega3_level: string;
  protein_per_100g: string;
  calories_per_100g: string;
  benefits_en: string[];
  benefits_ta: string[];
  benefits_hi: string[];
  cooking_tips: string[];
  disclaimer: string;
  generated_at?: string;
  model_used?: string;
};

export type CatchBroadcast = {
  id: string;
  title: string;
  message: string;
  harbour_source: string;
  target_category?: string | null;
  is_active: boolean;
  sent_by?: string | null;
  sent_at: string;
};

export type FcmToken = {
  id?: string;
  user_id?: string | null;
  token: string;
  role: "customer" | "driver" | "staff" | "admin";
  device_type: "web" | "android" | "ios";
  created_at?: string;
  updated_at?: string;
};

