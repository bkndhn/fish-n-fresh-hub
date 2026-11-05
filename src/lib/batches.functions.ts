import { createServerFn } from "@tanstack/react-start";
import { requireStaff, requireBranchAccess, getCallerBranchId } from "@/lib/authz.server";

export interface CreateBatchInput {
  batchNumber: string;
  productId: string;
  productName: string;
  supplierName?: string;
  catchDate: string;
  catchHarbour: string;
  boatNumber?: string;
  initialQuantity: number;
  unit: string;
  coldChainTempCelsius: number;
  shelfLifeHours: number;
  qualityGrade?: string;
  notes?: string;
}

export interface BatchRecallReport {
  batchNumber: string;
  productName: string;
  catchHarbour: string;
  boatNumber: string | null;
  impactedOrders: Array<{
    orderId: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    orderDate: string;
    totalAmount: number;
  }>;
  totalCustomersImpacted: number;
  totalQuantityRecalled: number;
}

export const createInwardBatch = createServerFn({ method: "POST" })
  .inputValidator((input: CreateBatchInput) => input)
  .handler(async ({ data }) => {
    const { userId } = await requireStaff();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const batchNo = data.batchNumber.trim().toUpperCase();
    const { data: existing } = await supabaseAdmin
      .from("inventory_batches").select("branch_id").eq("batch_number", batchNo).maybeSingle();
    if (existing) await requireBranchAccess(userId, (existing as any).branch_id);
    const callerBranch = await getCallerBranchId(userId);

    const shelfLife = Number(data.shelfLifeHours) || 72;
    const catchDateObj = new Date(data.catchDate || new Date().toISOString());
    const expiryDate = new Date(catchDateObj.getTime() + shelfLife * 3600 * 1000).toISOString();

    const payload = {
      batch_number: batchNo,
      branch_id: (existing as any)?.branch_id ?? callerBranch,
      product_id: data.productId,
      product_name: data.productName,
      supplier_name: data.supplierName || "Harbour Cooperative",
      catch_date: data.catchDate,
      catch_harbour: data.catchHarbour,
      boat_number: data.boatNumber || null,
      initial_quantity: Number(data.initialQuantity),
      current_quantity: Number(data.initialQuantity),
      unit: data.unit || "kg",
      cold_chain_temp_celsius: Number(data.coldChainTempCelsius) || -1.5,
      shelf_life_hours: shelfLife,
      expiry_date: expiryDate,
      quality_grade: data.qualityGrade || "Grade A+ (Export Quality)",
      notes: data.notes || null,
      status: "active",
    };

    const { data: created, error } = await supabaseAdmin
      .from("inventory_batches")
      .upsert(payload, { onConflict: "batch_number" })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { success: true, batch: created };
  });

export const updateBatchStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { batchId: string; status: "active" | "depleted" | "recalled" | "expired" }) => input)
  .handler(async ({ data }) => {
    const { userId } = await requireStaff();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("inventory_batches").select("branch_id").eq("id", data.batchId).maybeSingle();
    if (!target) throw new Error("Batch not found");
    await requireBranchAccess(userId, (target as any).branch_id);

    const { error } = await supabaseAdmin
      .from("inventory_batches")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.batchId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const executeBatchRecall = createServerFn({ method: "POST" })
  .inputValidator((input: { batchNumber: string }) => input)
  .handler(async ({ data }): Promise<BatchRecallReport> => {
    const { userId } = await requireStaff();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch batch details
    const { data: batch, error: bErr } = await supabaseAdmin
      .from("inventory_batches")
      .select("*")
      .eq("batch_number", data.batchNumber)
      .single();

    if (bErr || !batch) {
      throw new Error(`Batch ${data.batchNumber} not found.`);
    }
    await requireBranchAccess(userId, batch.branch_id);

    // Mark batch as recalled
    await supabaseAdmin
      .from("inventory_batches")
      .update({ status: "recalled", updated_at: new Date().toISOString() })
      .eq("id", batch.id);

    // 2. Find orders placed between catch date and expiry date containing this product
    const catchStart = new Date(batch.catch_date).toISOString();
    const expiryEnd = new Date(batch.expiry_date).toISOString();

    const { data: orders = [] } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, customer_email, created_at, total, items, branch_id")
      .gte("created_at", catchStart)
      .lte("created_at", expiryEnd)
      .or(batch.branch_id ? `branch_id.eq.${batch.branch_id},branch_id.is.null` : "branch_id.is.null");

    const impactedOrders: BatchRecallReport["impactedOrders"] = [];
    const customerPhoneSet = new Set<string>();

    (orders ?? []).forEach((o: any) => {
      const items = Array.isArray(o.items) ? o.items : [];
      const hasProduct = items.some(
        (it: any) =>
          it.productId === batch.product_id ||
          it.product_id === batch.product_id ||
          it.id === batch.product_id ||
          (it.name && it.name.toLowerCase().includes(batch.product_name.toLowerCase().split(" ")[0]))
      );

      if (hasProduct) {
        impactedOrders.push({
          orderId: o.id,
          orderNumber: o.order_number || o.id.slice(0, 8),
          customerName: o.customer_name || "Customer",
          customerPhone: o.customer_phone || "-",
          customerEmail: o.customer_email || undefined,
          orderDate: o.created_at,
          totalAmount: Number(o.total || 0),
        });
        if (o.customer_phone) customerPhoneSet.add(o.customer_phone);
      }
    });

    return {
      batchNumber: batch.batch_number,
      productName: batch.product_name,
      catchHarbour: batch.catch_harbour,
      boatNumber: batch.boat_number,
      impactedOrders,
      totalCustomersImpacted: customerPhoneSet.size || impactedOrders.length,
      totalQuantityRecalled: Number(batch.current_quantity || batch.initial_quantity),
    };
  });
