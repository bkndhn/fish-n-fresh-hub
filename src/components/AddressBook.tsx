import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
};

interface AddressBookProps {
  selectedAddress: string;
  onSelect: (address: string, lat?: number | null, lng?: number | null) => void;
}

export function AddressBook({ selectedAddress, onSelect }: AddressBookProps) {
  const { data } = useQuery({
    queryKey: ["customer_addresses"],
    queryFn: async (): Promise<SavedAddress[]> => {
      const { data: session } = await supabase.auth.getUser();
      if (!session.user) return [];
      const { data: rows, error } = await supabase
        .from("customer_addresses")
        .select("id, label, address, lat, lng, is_default")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return (rows ?? []) as SavedAddress[];
    },
  });

  const addresses = data ?? [];
  if (addresses.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {addresses.map((a) => (
        <Button
          key={a.id}
          type="button"
          size="sm"
          variant={selectedAddress === a.address ? "default" : "outline"}
          className="rounded-full"
          onClick={() => onSelect(a.address, a.lat, a.lng)}
        >
          <MapPin className="mr-1 size-3" />
          {a.label}
        </Button>
      ))}
    </div>
  );
}
