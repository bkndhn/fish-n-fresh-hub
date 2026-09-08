import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProducts from "./tools/list-products";
import listMyOrders from "./tools/list-my-orders";
import getOrderStatus from "./tools/get-order-status";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "fish-n-fresh",
  title: "Fish N Fresh",
  version: "0.1.0",
  instructions:
    "Tools for the Fish N Fresh seafood store. Use `list_products` to browse the catalogue, `list_my_orders` to see the signed-in customer's orders, and `get_order_status` to check delivery progress for one order.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProducts, listMyOrders, getOrderStatus],
});
