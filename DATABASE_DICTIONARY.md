# Database Schema Dictionary & Security Architecture

## 1. Overview & Database Architecture

The **Universal Retail Hub** database runs on **PostgreSQL 15+** hosted on Supabase. It uses strict relational constraints, Row-Level Security (RLS) policies, JSONB semi-structured documents for dynamic variant matrices, and PostgreSQL stored procedures (RPCs) for atomic transactional operations.

### Key Database Conventions
- **Primary Keys**: Standard UUIDs (`gen_random_uuid()`) or nanoid text identifiers.
- **Timestamps**: All tables use timezone-aware timestamps (`timestamptz`) defaulting to `now()`.
- **Currency & Money**: Stored as standard numeric decimal representations (`numeric(10, 2)`) to prevent IEEE floating-point rounding errors.
- **Tenant & Branch Scoping**: Operational tables include `branch_id uuid REFERENCES public.branches(id)` and/or `client_id text REFERENCES public.client_configs(id)`.

---

## 2. Table Data Dictionary

### 2.1 Branch & Tenant Management

#### `public.branches`
Defines operational store locations, dark stores, and fulfillment hubs.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `name` | `text` | No | - | Branch display name (e.g., "Kasimedu Harbour Hub") |
| `slug` | `text` | No | - | Unique URL friendly identifier (e.g., `kasimedu`) |
| `address` | `text` | Yes | `null` | Physical street address |
| `city` | `text` | Yes | `'Chennai'` | City location |
| `phone` | `text` | Yes | `null` | Local branch contact phone |
| `lat` | `double precision`| Yes | `null` | Geographic latitude for GPS geofencing |
| `lng` | `double precision`| Yes | `null` | Geographic longitude for GPS geofencing |
| `delivery_radius_km`| `numeric` | Yes | `15` | Maximum delivery distance radius in km |
| `is_active` | `boolean` | No | `true` | Operational status flag |
| `is_default` | `boolean` | No | `false` | Fallback branch if user location is undetected |
| `sort_order` | `integer` | No | `0` | Order in branch switcher UI |
| `created_at` | `timestamptz` | No | `now()` | Record creation timestamp |

#### `public.client_configs`
Enforces tenant quotas and Super Admin multi-client isolation rules.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `text` | No | - | Client tenant ID (e.g. `client_default`) |
| `name` | `text` | No | - | Client business name |
| `max_branches` | `integer` | No | `5` | Enforced branch creation limit set by Super Admin |
| `business_vertical`| `text` | No | `'seafood'` | Vertical template (`seafood`, `meat`, `grocery`, `apparel`) |
| `is_active` | `boolean` | No | `true` | Client billing/active standing status |
| `created_at` | `timestamptz` | No | `now()` | Tenant provisioning timestamp |

---

### 2.2 Product Catalog & Inventory

#### `public.products`
The core catalog item table containing pricing, stock levels, specifications, and variants.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | No | `gen_random_uuid()` | Primary product key |
| `name` | `text` | No | - | English item name |
| `name_tamil` | `text` | Yes | `null` | Regional vernacular name (e.g., தமிழ்) |
| `category` | `text` | No | - | Category classification string |
| `price` | `numeric(10,2)` | No | - | Customer selling price |
| `old_price` | `numeric(10,2)` | Yes | `null` | MRP for strike-through discount display |
| `buying_cost` | `numeric(10,2)` | Yes | `0` | Purchase cost per unit for real-time P&L calculation |
| `unit` | `text` | No | `'kg'` | Measurement unit (`kg`, `500g`, `pack`, `pc`) |
| `stock` | `numeric(10,2)` | Yes | `null` | Available inventory quantity |
| `low_stock_threshold`| `numeric` | Yes | `5` | Urgency alert trigger threshold |
| `is_available` | `boolean` | No | `true` | Availability toggle |
| `is_featured` | `boolean` | No | `false` | Homepage featured section highlight |
| `is_bestseller`| `boolean` | No | `false` | Bestseller badge highlight |
| `image_url` | `text` | Yes | `null` | Product photo URL |
| `barcode` | `text` | Yes | `null` | EAN/UPC barcode string for laser scanner lookup |
| `plu_code` | `text` | Yes | `null` | Price Look-Up code (1-4 digits) for POS numeric pad |
| `brand` | `text` | Yes | `null` | Brand name for retail/appliances |
| `model_number`| `text` | Yes | `null` | Manufacturer model number |
| `warranty_period_months`| `integer`| Yes | `0` | Warranty duration in months |
| `aisle_location` | `text` | Yes | `null` | Physical shelf/aisle location in store |
| `specifications` | `jsonb` | Yes | `'{}'::jsonb`| Dynamic key-value technical specs |
| `variants` | `jsonb` | Yes | `'[]'::jsonb`| 2D Size & Color variant matrix |
| `branch_id` | `uuid` | Yes | `null` | Optional branch location lock |
| `rating` | `numeric(3,1)` | No | `4.8` | Average customer review rating |
| `created_at` | `timestamptz` | No | `now()` | Catalog entry timestamp |

#### `public.categories`
Product category definitions with image assets and custom display sequence.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `name` | `text` | No | - | Category title |
| `image_url` | `text` | Yes | `null` | Category icon / photo URL |
| `sort_order` | `integer` | No | `0` | Display sequence order on storefront & POS |
| `is_active` | `boolean` | No | `true` | Visibility switch |

---

### 2.3 Orders & Fulfillment

#### `public.orders`
Customer and counter Point of Sale transaction records.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | No | `gen_random_uuid()` | Order ID |
| `order_number` | `text` | Yes | `null` | Formatted order identifier (e.g. `FNF-202609-1001`) |
| `customer_name` | `text` | No | - | Customer full name |
| `customer_phone`| `text` | No | - | 10-digit customer phone number |
| `customer_address`| `text`| Yes | `null` | Delivery address string |
| `items` | `jsonb` | No | - | Array of item objects `{ product_id, name, price, qty, unit }` |
| `subtotal` | `numeric` | No | - | Sum of item values before discounts/delivery |
| `discount` | `numeric` | No | `0` | Coupon or promotional deduction |
| `delivery_fee` | `numeric` | No | `0` | Delivery fee charged |
| `total` | `numeric` | No | - | Final payable total |
| `status` | `text` | No | `'pending'` | Status (`pending`, `confirmed`, `packed`, `out_for_delivery`, `delivered`, `cancelled`) |
| `payment_method`| `text` | No | `'cod'` | Payment mode (`cod`, `upi`, `card`, `counter_cash`, `counter_upi`) |
| `payment_status`| `text` | No | `'pending'` | Payment state (`pending`, `paid`, `refunded`) |
| `delivery_pin` | `text` | Yes | `null` | 4-digit security PIN verified by delivery driver |
| `branch_id` | `uuid` | Yes | `null` | Fulfilling branch ID |
| `driver_id` | `text` | Yes | `null` | Assigned driver user ID |
| `driver_name` | `text` | Yes | `null` | Assigned driver full name |
| `cod_settled` | `boolean`| No | `false` | Driver cash reconciliation flag |
| `settlement_id`| `text` | Yes | `null` | Cash settlement batch ID |
| `created_at` | `timestamptz` | No | `now()` | Order placement timestamp |

---

### 2.4 Financial Management & Accounting

#### `public.expenses`
Branch-specific operating expenses (Rent, Electricity, Fuel, Staff, Ice, Maintenance).

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | No | `gen_random_uuid()` | Expense primary key |
| `branch_id` | `uuid` | Yes | `null` | Branch associated with expense |
| `category` | `text` | No | - | Expense category (`Rent`, `Electricity`, `Logistics`, `Salaries`, etc.) |
| `amount` | `numeric(12,2)`| No | - | Expense expenditure in INR |
| `payment_mode` | `text` | No | `'Cash'` | Mode of payment (`Cash`, `UPI`, `Bank Transfer`, `Cheque`) |
| `expense_date` | `date` | No | `CURRENT_DATE`| Date of expenditure |
| `notes` | `text` | Yes | `null` | Expense rationale, invoice number, or vendor note |
| `created_by` | `uuid` | Yes | `null` | Staff member user ID |
| `created_at` | `timestamptz` | No | `now()` | Audit record creation timestamp |

#### `public.purchases`
Wholesale supplier purchases and direct procurement costs (COGS).

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | No | `gen_random_uuid()` | Purchase primary key |
| `branch_id` | `uuid` | Yes | `null` | Receiving branch |
| `supplier_name` | `text` | No | - | Harbor vendor or supplier company |
| `invoice_number`| `text` | Yes | `null` | Supplier tax invoice / bill number |
| `total_amount` | `numeric(12,2)`| No | - | Total procurement billing in INR |
| `items` | `jsonb` | No | `'[]'::jsonb` | Procurement line items `{ product_id, name, qty, rate, total }` |
| `payment_status`| `text` | No | `'paid'` | Supplier payout state (`paid`, `partial`, `credit`) |
| `purchase_date` | `date` | No | `CURRENT_DATE`| Date of arrival at dock/store |
| `created_at` | `timestamptz` | No | `now()` | Record creation timestamp |

#### `public.waste_logs`
Shrinkage, transit mortality, cleaning losses, and expired inventory logs.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | No | `gen_random_uuid()` | Waste log ID |
| `branch_id` | `uuid` | Yes | `null` | Branch location |
| `product_id` | `uuid` | No | - | Product reference |
| `quantity` | `numeric(10,2)`| No | - | Quantity spoiled or lost |
| `unit` | `text` | No | `'kg'` | Measurement unit |
| `cost_loss` | `numeric(10,2)`| No | `0` | Total loss in INR debited from gross profit |
| `reason` | `text` | No | - | Reason code (`Spoilage`, `Transit Damage`, `Expired`, `Trimming`) |
| `logged_at` | `timestamptz` | No | `now()` | Spoilage record timestamp |

---

### 2.5 Security, Governance & Killswitch

#### `public.user_roles`
Role-Based Access Control (RBAC) bindings.

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `user_id` | `uuid` | No | Supabase auth user reference |
| `role` | `app_role` | No | Enum: `super_admin`, `admin`, `manager`, `cashier`, `inventory_manager`, `support_staff`, `driver`, `staff`, `user` |

#### `public.platform_revocations`
Cryptographic platform session termination channel.

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | No | Revocation event primary key |
| `scope` | `text` | No | Scope: `'global'` (entire app), `'user'` (single UID), `'branch'` (single store) |
| `target_id` | `text` | Yes | User ID or Branch ID target |
| `reason` | `text` | No | Security audit rationale |
| `created_at` | `timestamptz` | No | Timestamp of killswitch trigger |

---

## 3. PostgreSQL Stored Procedures (RPCs)

### `is_admin()`
- **Returns**: `boolean`
- **Logic**: Inspects `auth.uid()` against `user_roles` where `role = 'admin'`.

### `is_super_admin()`
- **Returns**: `boolean`
- **Logic**: Inspects `auth.uid()` against `user_roles` where `role = 'super_admin'`. Super Admin is partitioned strictly for client governance and quota enforcement.

### `is_staff()`
- **Returns**: `boolean`
- **Logic**: Verifies if caller has any operational role (`admin`, `manager`, `cashier`, `inventory_manager`, `driver`, `support_staff`).

### `verify_order_delivery_pin(p_order_id uuid, p_pin text)`
- **Returns**: `jsonb`
- **Logic**: Verifies the delivery PIN provided by the customer at doorstep against the stored `delivery_pin`. If matched, updates `status = 'delivered'`, sets `delivered_at = now()`, and returns `{ success: true }`.
