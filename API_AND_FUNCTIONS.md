# API & Server Functions Reference

This document catalogs all server-side RPC functions (`*.functions.ts`), client query hooks (`queries.ts`, `admin.ts`), and hardware event interfaces in **Universal Retail Hub**.

---

## 1. TanStack Start Server Functions

All backend procedures are executed as type-safe RPCs defined with `createServerFn`. They run securely in edge or server runtimes with elevated privileges (`supabaseAdmin`) where necessary.

### 1.1 Order & Fulfillment Functions (`src/lib/orders.functions.ts`)

#### `placeOrder`
- **Method**: `POST`
- **Input**:
  ```ts
  {
    customerName: string;
    customerPhone: string;
    customerAddress?: string;
    items: OrderItem[];
    subtotal: number;
    discount?: number;
    deliveryFee?: number;
    total: number;
    paymentMethod: "cod" | "upi" | "card" | "counter_cash" | "counter_upi";
    fulfillmentType: "delivery" | "pickup" | "pos_counter";
    branchId?: string;
  }
  ```
- **Returns**: `{ success: boolean; orderId: string; orderNumber: string; deliveryPin: string }`
- **Security**: Validates input format, generates a secure 4-digit doorstep delivery PIN, and atomically decrements product inventory.

#### `updateOrderStatus`
- **Method**: `POST`
- **Input**: `{ orderId: string; status: OrderStatus; driverId?: string; notes?: string }`
- **Returns**: `{ success: boolean; status: OrderStatus }`
- **Description**: Updates order status (`confirmed`, `packed`, `out_for_delivery`, `delivered`, `cancelled`). Triggers real-time notification to customer.

---

### 1.2 Inventory & Batch Management (`src/lib/batches.functions.ts`)

#### `createInventoryBatch`
- **Method**: `POST`
- **Input**:
  ```ts
  {
    productId: string;
    batchNumber: string;
    purchaseRate: number;
    initialQuantity: number;
    supplierName: string;
    invoiceNumber?: string;
    expiryDate?: string;
    branchId?: string;
  }
  ```
- **Returns**: `{ success: boolean; batchId: string }`
- **Description**: Creates a FIFO inventory lot for precise Cost of Goods Sold (COGS) tracking.

---

### 1.3 Subscriptions (`src/lib/subscriptions.functions.ts`)

#### `createSubscription`
- **Method**: `POST`
- **Input**:
  ```ts
  {
    userId?: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    frequency: "weekly" | "bi_weekly" | "daily";
    dayOfWeek: string;
    preferredSlot: string;
    pricePerUnit: number;
  }
  ```
- **Returns**: `{ success: boolean; subscriptionId: string }`
- **Description**: Registers automated weekly delivery schedules with priority dispatch and 5% recurring order discount.

---

### 1.4 Staff & Security (`src/lib/staff.functions.ts`)

#### `createStaffMember`
- **Method**: `POST`
- **Input**: `{ email: string; fullName: string; role: AppRole; branchId?: string }`
- **Returns**: `{ success: boolean; userId: string }`
- **Description**: Creates staff profile and assigns Role-Based Access Control (RBAC) in `user_roles`.

---

## 2. TanStack Query Options Reference

The application uses pre-configured `queryOptions` objects for 100% type-safe in-memory caching and 0ms instantaneous route transitions.

### Storefront Queries (`src/lib/queries.ts`)

| Query Function / Option | Cache Key | Default `staleTime` | Notes |
| :--- | :--- | :--- | :--- |
| `productsQuery(branchId)` | `["products", branchId]` | 10 Minutes | Fetches catalog filtered by branch or all available. Sanitizes images. |
| `categoriesQuery` | `["categories"]` | 15 Minutes | Sells display sequence with image URLs. |
| `bannersQuery` | `["banners"]` | 15 Minutes | Promotional hero sliders. |
| `settingsQuery` | `["store_settings"]` | 15 Minutes | Store branding, operating hours, and express delivery SLAs. |
| `productQuery(id)` | `["product", id]` | 10 Minutes | Single product detail view. |
| `ordersByPhoneQuery(phone)`| `["orders", phone]` | 2 Minutes | Customer order history by phone. |

### Admin Queries (`src/lib/admin.ts` & `src/lib/multiBranch.ts`)

| Query Function / Option | Cache Key | Default `staleTime` | Notes |
| :--- | :--- | :--- | :--- |
| `myRolesQuery` | `["admin", "my-roles"]` | 15 Minutes | Session roles. Never unmounts `AdminShell`. |
| `adminOrdersQuery(branchId)` | `["admin", "orders", branch]` | 10 Minutes | Real-time order pipeline. |
| `adminProductsQuery(branchId)` | `["admin", "products", branch]` | 10 Minutes | Full catalog with buying costs & PLU. |
| `branchesQuery` | `["branches", "all"]` | 5 Minutes | All branch locations for admin switcher. |
| `activeBranchesQuery` | `["branches", "active"]`| 5 Minutes | Customer-facing active branches. |

---

## 3. Hardware Event Interfaces

Hardware devices emit standardized browser `CustomEvent` objects on the global `window` object for loose coupling with React components.

### 3.1 Weighing Scale Events (`src/lib/weighingScale.ts`)

```ts
// Dispatched on every continuous weight sample received from serial/HID
window.addEventListener("scale_weight_change", (event: CustomEvent<{
  weight: number;      // Current weight (e.g. 1.450)
  unit: string;        // Unit ("kg" or "g")
  isStable: boolean;   // True if reading is mechanically stable
  raw: string;         // Raw ASCII packet
}>) => { ... });

// Dispatched once when weight stabilizes >= 20g (Hands-free capture)
window.addEventListener("scale_weight_stable", (event: CustomEvent<{
  weight: number;
  unit: string;
}>) => { ... });

// Dispatched when scale is plugged in or disconnected
window.addEventListener("scale_status_change", (event: CustomEvent<{
  connected: boolean;
  portType: "serial" | "hid" | "simulator";
}>) => { ... });
```

### 3.2 Realtime Cache Invalidation Events (`src/routes/__root.tsx`)

```ts
// Dispatched when store settings change in Supabase CDC
window.addEventListener("store_settings_updated", () => { ... });

// Dispatched when PWA prompt is ready for install
window.addEventListener("pwa-prompt-ready", () => { ... });
```
