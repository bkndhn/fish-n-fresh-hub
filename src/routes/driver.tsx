import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  startDriverLocationWatcher, 
  startKeepAliveAudioBeacon, 
  stopKeepAliveAudioBeacon, 
  requestScreenWakeLock, 
  releaseScreenWakeLock,
  type DriverGeoCoordinate
} from "@/lib/driverLocation";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { getGoogleMapsDirUrl } from "@/lib/maps";
import { formatINR } from "@/lib/format";
import { registerDriverToken } from "@/lib/fcm";
import { triggerOrderAlert } from "@/lib/notifications.functions";
import { 
  Phone, MapPin, Navigation, PackageCheck, Truck, CheckCircle2, 
  AlertTriangle, Power, Satellite, Check
} from "lucide-react";

// @ts-ignore
export const Route = createFileRoute("/driver")({
  component: DriverPanel,
});

function DriverPanel() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [session, setSession] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [driverName, setDriverName] = useState("Driver");
  const [isOnline, setIsOnline] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [pinDialogOrder, setPinDialogOrder] = useState<any>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // 1. Auth Guard
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/auth" });
        return;
      }
      setSession(session);
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
        
      const userRoles = roles?.map(r => r.role) || [];
      if (userRoles.includes("driver") || userRoles.includes("staff") || userRoles.includes("admin")) {
        setHasAccess(true);
        setDriverName(session.user.user_metadata?.['full_name'] || session.user.email?.split("@")[0] || "Driver");
      } else {
        setHasAccess(false);
      }
    }
    checkAuth();
  }, [navigate]);

  // 2. Fetch Active Deliveries
  const { data: activeOrders = [] } = useQuery({
    queryKey: ["driver_active_orders", session?.user?.id],
    enabled: !!session?.user?.id && hasAccess === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .or(`driver_id.eq.${session.user.id},driver_name.ilike.%${driverName}%`)
        .not("status", "in", "('delivered','cancelled')")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch Completed Today
  const { data: completedOrders = [] } = useQuery({
    queryKey: ["driver_completed_orders", session?.user?.id],
    enabled: !!session?.user?.id && hasAccess === true,
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", session.user.id)
        .eq("status", "delivered")
        .gte("updated_at", startOfDay.toISOString());
      
      if (error) throw error;
      return data;
    },
  });

  // Real-time updates
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel("driver_orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["driver_active_orders"] });
        qc.invalidateQueries({ queryKey: ["driver_completed_orders"] });
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, qc]);

  // Handle GPS location updates
  useEffect(() => {
    let stopWatcher = () => {};
    if (isOnline && session?.user?.id) {
      startKeepAliveAudioBeacon();
      requestScreenWakeLock();
      // Register as driver for push notifications (packed order alerts)
      void registerDriverToken(session.user.id);
      
      stopWatcher = startDriverLocationWatcher(async (coord: DriverGeoCoordinate) => {
        setGpsAccuracy(coord.accuracy);
        
        // Upsert to driver_locations
        await (supabase.from("driver_locations" as any) as any).upsert({
          user_id: session.user.id,
          lat: coord.lat,
          lng: coord.lng,
          accuracy: coord.accuracy,
          heading: coord.heading,
          speed: coord.speed,
          is_online: true,
          updated_at: new Date().toISOString()
        } as any);
      });
    } else if (!isOnline && session?.user?.id) {
      stopKeepAliveAudioBeacon();
      releaseScreenWakeLock();
      setGpsAccuracy(null);
      
      // Mark offline
      (supabase.from("driver_locations" as any) as any).update({ is_online: false }).eq("user_id", session.user.id).then();
    }
    
    return () => {
      stopWatcher();
      if (isOnline) {
        stopKeepAliveAudioBeacon();
        releaseScreenWakeLock();
      }
    };
  }, [isOnline, session]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { data: order } = await supabase.from("orders").select("status").eq("id", orderId).single();
    const oldStatus = order?.status;
    
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);
      
    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Order marked as ${status.replace(/_/g, " ")}`);
      // Trigger background push alert via Server Action
      void triggerOrderAlert({ data: { orderId, eventType: 'UPDATE', ...(oldStatus ? { oldStatus } : {}) } });
    }
  };

  const verifyPin = async () => {
    if (!pinDialogOrder || !enteredPin) return;
    setIsVerifying(true);
    
    const { data, error } = await supabase.rpc("verify_and_deliver_order", {
      p_order_id: pinDialogOrder.id,
      p_entered_pin: enteredPin,
      p_is_admin_override: false,
    });
    
    setIsVerifying(false);
    
    if (error || (data as any)?.success === false) {
      toast.error("Wrong PIN — ask customer to show their PIN");
    } else {
      toast.success("Order Delivered Successfully!");
      setPinDialogOrder(null);
      setEnteredPin("");
      qc.invalidateQueries({ queryKey: ["driver_active_orders"] });
      qc.invalidateQueries({ queryKey: ["driver_completed_orders"] });
    }
  };

  if (hasAccess === null) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <div className="mx-auto size-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
          <p>Verifying access...</p>
        </div>
      </AppShell>
    );
  }

  if (hasAccess === false) {
    return (
      <AppShell>
        <div className="py-20 text-center max-w-md mx-auto">
          <AlertTriangle className="size-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="mt-2 text-muted-foreground">
            You do not have permission to access the Driver Panel. Contact an administrator.
          </p>
        </div>
      </AppShell>
    );
  }

  const codTotal = completedOrders
    .filter(o => o.payment_method === "cod")
    .reduce((acc, o) => acc + Number(o.total), 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-6 pb-12">
        {/* Header & Shift Controls */}
        <div className="flex items-center justify-between rounded-2xl bg-card border p-4 shadow-sm">
          <div>
            <h1 className="text-lg font-bold">Hi, {driverName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`size-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
              <span className="text-sm font-medium">{isOnline ? 'Online & Tracking' : 'Offline'}</span>
            </div>
            {isOnline && gpsAccuracy && (
              <p className="text-[10px] text-muted-foreground flex items-center mt-1">
                <Satellite className="size-3 mr-1" /> GPS Accuracy: {Math.round(gpsAccuracy)}m
              </p>
            )}
          </div>
          <Button
            size="lg"
            variant={isOnline ? "destructive" : "default"}
            onClick={() => setIsOnline(!isOnline)}
            className="rounded-xl font-bold"
          >
            <Power className="mr-2 size-4" />
            {isOnline ? "Go Offline" : "Go Online"}
          </Button>
        </div>

        {/* Active Deliveries */}
        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Truck className="size-5 text-primary" /> Active Deliveries
          </h2>
          
          {activeOrders.length === 0 ? (
            <div className="text-center py-10 border rounded-2xl bg-muted/20 border-dashed">
              <CheckCircle2 className="mx-auto size-10 text-muted-foreground mb-2" />
              <p className="font-medium text-muted-foreground">No active deliveries</p>
              <p className="text-xs text-muted-foreground">Stay online to receive orders.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <Card key={order.id} className="border-primary/20 shadow-sm overflow-hidden">
                  <div className="bg-primary/5 p-3 border-b border-border/50 flex justify-between items-center">
                    <div>
                      <p className="font-bold">Order #{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{formatINR(Number(order.total))} • {order.payment_method?.toUpperCase()}</p>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs font-semibold bg-background">
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <p className="font-bold text-sm">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground flex items-start gap-1 mt-1">
                        <MapPin className="size-4 shrink-0 mt-0.5 text-primary" /> 
                        {order.customer_address}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 rounded-xl text-xs" asChild>
                        <a href={`tel:${order.customer_phone}`}>
                          <Phone className="size-3.5 mr-1" /> Call
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 rounded-xl text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-50" asChild>
                        <a href={getWhatsAppUrl(order.customer_phone, `Hi, I am your delivery driver for order #${order.order_number || order.id.slice(0, 8)}.`)} target="_blank" rel="noreferrer">
                          <WhatsAppIcon className="size-3.5 mr-1" /> WhatsApp
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 rounded-xl text-xs text-blue-600 border-blue-500/30 hover:bg-blue-50" asChild>
                        <a href={getGoogleMapsDirUrl(order.location_lat, order.location_lng, order.customer_address)} target="_blank" rel="noreferrer">
                          <Navigation className="size-3.5 mr-1" /> Navigate
                        </a>
                      </Button>
                    </div>

                    <div className="pt-2">
                      {order.status === "confirmed" && (
                        <Button 
                          className="w-full rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white" 
                          onClick={() => updateOrderStatus(order.id, "packed")}
                        >
                          <PackageCheck className="mr-2 size-4" /> Mark as Packed
                        </Button>
                      )}
                      
                      {(order.status === "packed" || order.status === "assigned") && (
                        <Button 
                          className="w-full rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white" 
                          onClick={() => updateOrderStatus(order.id, "out_for_delivery")}
                        >
                          <Navigation className="mr-2 size-4" /> Start Delivery
                        </Button>
                      )}
                      
                      {order.status === "out_for_delivery" && (
                        <Button 
                          className="w-full rounded-xl font-bold bg-primary hover:bg-primary/90 text-white" 
                          onClick={() => setPinDialogOrder(order)}
                        >
                          <CheckCircle2 className="mr-2 size-4" /> Mark Delivered (Enter PIN)
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Completed Today */}
        <div className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Completed Today</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-display font-bold">{completedOrders.length}</p>
              <p className="text-xs text-muted-foreground">Deliveries</p>
            </div>
            <div className="bg-card border rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-display font-bold text-emerald-600">{formatINR(codTotal)}</p>
              <p className="text-xs text-muted-foreground">COD Collected</p>
            </div>
          </div>
        </div>
      </div>

      {/* PIN Verification Dialog */}
      <Dialog open={!!pinDialogOrder} onOpenChange={(open) => !open && setPinDialogOrder(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md p-6 text-center">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Enter Delivery PIN</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Ask the customer for the 4-digit PIN shown on their order tracking page.
            </p>
            <Input 
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              className="text-center text-3xl tracking-[0.5em] font-mono h-16 rounded-2xl"
              maxLength={4}
              type="tel"
            />
            {pinDialogOrder?.payment_method === "cod" && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700 font-semibold flex items-center justify-center gap-2">
                <AlertTriangle className="size-4" />
                Collect {formatINR(Number(pinDialogOrder.total))} Cash
              </div>
            )}
            <Button 
              className="w-full rounded-xl h-12 text-lg font-bold mt-2" 
              onClick={verifyPin}
              disabled={enteredPin.length !== 4 || isVerifying}
            >
              {isVerifying ? "Verifying..." : "Confirm Delivery"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

export default DriverPanel;


