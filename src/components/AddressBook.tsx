import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Home,
  Briefcase,
  MapPin,
  Plus,
  Trash2,
  Edit3,
  Star,
  Navigation,
  Check,
  Loader2,
  Building,
  Compass,
  Route as RouteIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { MapPinPickerModal } from "@/components/MapPinPickerModal";
import { DeliveryRouteModal } from "@/components/DeliveryRouteModal";
import type { GeocodedAddress } from "@/lib/maps";

export type SavedAddress = {
  id: string;
  label: "Home" | "Office" | "Other" | string;
  address: string;
  door_no?: string;
  street?: string;
  landmark?: string;
  city?: string;
  pincode?: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
};

const LOCAL_STORAGE_KEY = "fishnfresh_saved_addresses_v2";

function getLocalAddresses(): SavedAddress[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAddresses(list: SavedAddress[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota
  }
}

interface AddressBookProps {
  selectedAddress: string;
  onSelect: (address: string, lat?: number | null, lng?: number | null) => void;
}

export function AddressBook({ selectedAddress, onSelect }: AddressBookProps) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);

  // Form fields
  const [label, setLabel] = useState<"Home" | "Office" | "Other">("Home");
  const [doorNo, setDoorNo] = useState("");
  const [street, setStreet] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("Chennai");
  const [pincode, setPincode] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const [routeModalAddress, setRouteModalAddress] = useState<SavedAddress | null>(null);

  const handlePinConfirmed = (geocoded: GeocodedAddress) => {
    setLat(geocoded.lat);
    setLng(geocoded.lng);
    if (geocoded.street) setStreet(geocoded.street);
    if (geocoded.doorNo) setDoorNo(geocoded.doorNo);
    if (geocoded.landmark) setLandmark(geocoded.landmark);
    if (geocoded.city) setCity(geocoded.city);
    if (geocoded.pincode) setPincode(geocoded.pincode);
    setModalOpen(true);
  };

  const { data: addresses = [] } = useQuery({
    queryKey: ["customer_addresses"],
    queryFn: async (): Promise<SavedAddress[]> => {
      const local = getLocalAddresses();
      try {
        const { data: session } = await supabase.auth.getUser();
        if (!session.user) return local;

        const { data: rows, error } = await supabase
          .from("customer_addresses")
          .select("id, label, address, lat, lng, is_default")
          .eq("user_id", session.user.id)
          .order("is_default", { ascending: false });

        if (error || !rows) return local;

        // Merge Supabase rows with local addresses (de-duplicate by id or address)
        const dbList: SavedAddress[] = rows.map((r) => ({
          id: r.id,
          label: r.label,
          address: r.address,
          lat: r.lat,
          lng: r.lng,
          is_default: r.is_default,
        }));

        if (dbList.length === 0 && local.length > 0) {
          return local;
        }
        return dbList;
      } catch {
        return local;
      }
    },
  });

  // Auto-select default address on initial mount if none selected
  useEffect(() => {
    if (!selectedAddress && addresses.length > 0) {
      const def = addresses.find((a) => a.is_default) || addresses[0];
      if (def) {
        onSelect(def.address, def.lat, def.lng);
      }
    }
  }, [addresses, selectedAddress, onSelect]);

  const resetForm = () => {
    setEditingAddress(null);
    setLabel("Home");
    setDoorNo("");
    setStreet("");
    setLandmark("");
    setCity("Chennai");
    setPincode("");
    setLat(null);
    setLng(null);
    setIsDefault(addresses.length === 0);
  };

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (addr: SavedAddress) => {
    setEditingAddress(addr);
    setLabel(
      (addr.label === "Home" || addr.label === "Office" || addr.label === "Other")
        ? addr.label
        : "Home"
    );
    setDoorNo(addr.door_no || "");
    setStreet(addr.street || addr.address);
    setLandmark(addr.landmark || "");
    setCity(addr.city || "Chennai");
    setPincode(addr.pincode || "");
    setLat(addr.lat);
    setLng(addr.lng);
    setIsDefault(addr.is_default);
    setModalOpen(true);
  };

  // GPS Auto-detect & Reverse Geocode
  const handleGpsAutofill = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setLat(latitude);
        setLng(longitude);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            
            const detectedStreet = [
              addr.road,
              addr.suburb || addr.neighbourhood,
            ].filter(Boolean).join(", ");

            const detectedCity = addr.city || addr.town || addr.county || "Chennai";
            const detectedPincode = addr.postcode ? addr.postcode.replace(/\D/g, "").slice(0, 6) : "";

            if (detectedStreet) setStreet(detectedStreet);
            if (detectedCity) setCity(detectedCity);
            if (detectedPincode) setPincode(detectedPincode);

            toast.success(`GPS Location detected! ${detectedPincode ? `Pincode: ${detectedPincode}` : ""}`);
          } else {
            toast.success("GPS coordinates detected!");
          }
        } catch {
          toast.success("GPS coordinates detected!");
        } finally {
          setDetectingGps(false);
        }
      },
      (err) => {
        setDetectingGps(false);
        toast.error("Unable to access GPS location. Please allow location permissions in your browser.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Save Address (Create or Edit)
  const handleSave = async () => {
    if (!street.trim()) {
      toast.error("Please enter street address");
      return;
    }

    const fullFormattedAddress = [
      doorNo.trim(),
      street.trim(),
      landmark.trim() ? `Near ${landmark.trim()}` : "",
      city.trim(),
      pincode.trim() ? `PIN: ${pincode.trim()}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    const newAddrObj: SavedAddress = {
      id: editingAddress ? editingAddress.id : `addr_${Date.now()}`,
      label,
      address: fullFormattedAddress,
      door_no: doorNo.trim(),
      street: street.trim(),
      landmark: landmark.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
      lat,
      lng,
      is_default: isDefault,
    };

    // Update Local Storage
    let updated = getLocalAddresses();
    if (editingAddress) {
      updated = updated.map((a) => (a.id === editingAddress.id ? newAddrObj : a));
    } else {
      if (isDefault) {
        updated = updated.map((a) => ({ ...a, is_default: false }));
      }
      updated.push(newAddrObj);
    }
    if (isDefault) {
      updated = updated.map((a) => (a.id === newAddrObj.id ? { ...a, is_default: true } : { ...a, is_default: false }));
    }
    saveLocalAddresses(updated);

    // Try syncing to Supabase if authenticated
    try {
      const { data: session } = await supabase.auth.getUser();
      if (session.user) {
        if (isDefault) {
          await supabase
            .from("customer_addresses")
            .update({ is_default: false })
            .eq("user_id", session.user.id);
        }

        if (editingAddress) {
          await supabase
            .from("customer_addresses")
            .update({
              label,
              address: fullFormattedAddress,
              lat,
              lng,
              is_default: isDefault,
            })
            .eq("id", editingAddress.id);
        } else {
          await supabase.from("customer_addresses").insert({
            user_id: session.user.id,
            label,
            address: fullFormattedAddress,
            lat,
            lng,
            is_default: isDefault,
          });
        }
      }
    } catch {
      // Offline fallback succeeded
    }

    qc.invalidateQueries({ queryKey: ["customer_addresses"] });
    onSelect(fullFormattedAddress, lat, lng);
    setModalOpen(false);
    toast.success(editingAddress ? "Address updated" : "New address saved");
  };

  // Delete Address
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = getLocalAddresses().filter((a) => a.id !== id);
    saveLocalAddresses(updated);

    try {
      await supabase.from("customer_addresses").delete().eq("id", id);
    } catch {
      // Local deleted
    }

    qc.invalidateQueries({ queryKey: ["customer_addresses"] });
    toast.success("Address deleted");
  };

  // Set as Default
  const handleSetDefault = async (addr: SavedAddress, e: React.MouseEvent) => {
    e.stopPropagation();
    let updated = getLocalAddresses().map((a) => ({
      ...a,
      is_default: a.id === addr.id,
    }));
    saveLocalAddresses(updated);

    try {
      const { data: session } = await supabase.auth.getUser();
      if (session.user) {
        await supabase
          .from("customer_addresses")
          .update({ is_default: false })
          .eq("user_id", session.user.id);
        await supabase
          .from("customer_addresses")
          .update({ is_default: true })
          .eq("id", addr.id);
      }
    } catch {
      // Local fallback
    }

    qc.invalidateQueries({ queryKey: ["customer_addresses"] });
    toast.success(`Set ${addr.label} as default address`);
  };

  const getLabelIcon = (lbl: string) => {
    const l = lbl.toLowerCase();
    if (l.includes("home")) return <Home className="size-3.5" />;
    if (l.includes("office") || l.includes("work")) return <Building className="size-3.5" />;
    return <MapPin className="size-3.5" />;
  };

  return (
    <div className="space-y-3">
      {/* Saved Addresses List / Cards */}
      {addresses.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {addresses.map((a) => {
            const isSelected = selectedAddress === a.address;
            return (
              <div
                key={a.id}
                onClick={() => onSelect(a.address, a.lat, a.lng)}
                className={`relative flex flex-col justify-between rounded-2xl border p-3 cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/80 px-2.5 py-0.5 text-xs font-semibold text-foreground">
                      {getLabelIcon(a.label)}
                      {a.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {a.is_default && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-900">
                          <Star className="size-2.5 fill-current" /> Default
                        </span>
                      )}
                      {isSelected && (
                        <span className="size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="size-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-foreground font-medium line-clamp-2 leading-relaxed">
                    {a.address}
                  </p>
                  {a.lat && a.lng && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400">
                      <span className="inline-flex items-center gap-1 font-mono font-medium">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        📍 Pinned: {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRouteModalAddress(a);
                        }}
                        className="underline hover:text-primary font-semibold flex items-center gap-1"
                      >
                        <Compass className="size-3" /> View Route
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(a);
                      }}
                      className="hover:text-primary flex items-center gap-1"
                    >
                      <Edit3 className="size-3" /> Edit
                    </button>
                    {!a.is_default && (
                      <button
                        type="button"
                        onClick={(e) => handleSetDefault(a, e)}
                        className="hover:text-amber-600 flex items-center gap-1"
                      >
                        <Star className="size-3" /> Set Default
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(a.id, e)}
                    className="hover:text-destructive flex items-center gap-1 text-muted-foreground/80 hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Buttons: Add Address & Move Pin on Map */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openAddModal}
          className="rounded-xl text-xs font-semibold gap-1.5 h-9"
        >
          <Plus className="size-3.5 text-primary" /> Add New Address
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            resetForm();
            setPinPickerOpen(true);
          }}
          className="rounded-xl text-xs font-bold gap-1.5 h-9 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 shadow-2xs"
        >
          <MapPin className="size-3.5 text-primary animate-bounce" /> 📍 Move Pin on Map
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={detectingGps}
          onClick={handleGpsAutofill}
          className="rounded-xl text-xs font-medium gap-1.5 h-9 text-muted-foreground hover:text-foreground"
        >
          {detectingGps ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Navigation className="size-3.5" />
          )}
          {detectingGps ? "Detecting GPS..." : "Quick GPS"}
        </Button>
      </div>

      {/* Add / Edit Address Dialog Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="size-5 text-primary" />
              {editingAddress ? "Edit Delivery Address" : "Add Delivery Address"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Interactive Map Pinning Option */}
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3 flex items-center justify-between gap-2 shadow-2xs">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground">Interactive Doorstep Pin</span>
                  {lat && lng && (
                    <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold">
                      ✓ Exact Pin Set
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {lat && lng
                    ? `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
                    : "Drag the pin directly over your building gate or house"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setPinPickerOpen(true)}
                className="rounded-xl text-xs shrink-0 gap-1.5 bg-primary text-primary-foreground font-bold shadow-xs"
              >
                <MapPin className="size-3.5" />
                {lat && lng ? "Adjust Pin" : "Move Pin"}
              </Button>
            </div>

            {/* GPS Autofill Banner */}
            <div className="rounded-2xl border border-border/80 bg-muted/30 p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-foreground">Fast Auto-fill with GPS</p>
                <p className="text-[11px] text-muted-foreground">
                  Fetch road and 6-digit pincode via device sensor
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={detectingGps}
                onClick={handleGpsAutofill}
                className="rounded-xl text-xs shrink-0 gap-1"
              >
                {detectingGps ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Navigation className="size-3.5" />
                )}
                {detectingGps ? "Locating…" : "Use GPS"}
              </Button>
            </div>

            {/* Label Chips: Home / Office / Other */}
            <div>
              <Label className="text-xs font-semibold">Address Type</Label>
              <div className="mt-1.5 flex gap-2">
                {(
                  [
                    { id: "Home", label: "Home", icon: Home },
                    { id: "Office", label: "Work / Office", icon: Building },
                    { id: "Other", label: "Other", icon: MapPin },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = label === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLabel(item.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <Icon className="size-3.5" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Door No / House & Street */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="doorNo" className="text-xs font-semibold">Flat / Door No</Label>
                <Input
                  id="doorNo"
                  placeholder="e.g. 4B"
                  value={doorNo}
                  onChange={(e) => setDoorNo(e.target.value)}
                  className="mt-1 rounded-xl text-xs"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="street" className="text-xs font-semibold">Street & Building *</Label>
                <Input
                  id="street"
                  placeholder="e.g. Marina Beach Rd, Green Apts"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="mt-1 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Landmark */}
            <div>
              <Label htmlFor="landmark" className="text-xs font-semibold">Landmark (Optional)</Label>
              <Input
                id="landmark"
                placeholder="e.g. Opposite Lighthouse, Near Metro"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="mt-1 rounded-xl text-xs"
              />
            </div>

            {/* City & Pincode */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="city" className="text-xs font-semibold">City</Label>
                <Input
                  id="city"
                  placeholder="e.g. Chennai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1 rounded-xl text-xs"
                />
              </div>
              <div>
                <Label htmlFor="pincode" className="text-xs font-semibold">Pincode *</Label>
                <Input
                  id="pincode"
                  placeholder="e.g. 600004"
                  maxLength={6}
                  inputMode="numeric"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-1 rounded-xl text-xs font-mono font-medium tracking-wider"
                />
              </div>
            </div>

            {/* Set Default Toggle */}
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="size-4 rounded-sm border-primary text-primary accent-primary"
              />
              <span>Set as default delivery address</span>
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="rounded-xl text-xs font-bold"
            >
              Save & Use Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interactive Map Pin Picker Modal */}
      <MapPinPickerModal
        open={pinPickerOpen}
        onOpenChange={setPinPickerOpen}
        initialLat={lat}
        initialLng={lng}
        initialAddress={street}
        onConfirm={handlePinConfirmed}
      />

      {/* Delivery Route Modal */}
      {routeModalAddress && (
        <DeliveryRouteModal
          open={!!routeModalAddress}
          onOpenChange={(open) => !open && setRouteModalAddress(null)}
          customerName={routeModalAddress.label}
          customerAddress={routeModalAddress.address}
          destLat={routeModalAddress.lat}
          destLng={routeModalAddress.lng}
        />
      )}
    </div>
  );
}

