const fs = require('fs');
const path = 'src/routes/_authenticated/admin/settings.tsx';
let content = fs.readFileSync(path, 'utf8');

const anchor = `  const SETTINGS_SECTIONS: SettingSectionItem[] = useMemo(() => [`;
const inject = `  const SETTINGS_SECTIONS: SettingSectionItem[] = useMemo(() => [
    {
      id: "catalog_details",
      tab: "general" as const,
      tabLabel: "General & Brand",
      title: "Store Catalog Config",
      description: "Customize how products are displayed",
      content: (
        <Card className="rounded-2xl border-border/60 shadow-xs mb-6">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="size-4 text-primary" /> Store Catalog Config
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <div className="space-y-0.5 max-w-sm">
                <Label className="text-sm font-semibold">Enable Product Detail Pages</Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  If disabled, customers cannot click into a product to view the full gallery/details. They can only add it directly to cart from the catalog list.
                </p>
              </div>
              <Switch
                checked={form.enable_product_details ?? true}
                onCheckedChange={(val) => setForm({ ...form, enable_product_details: val })}
              />
            </div>
          </CardContent>
        </Card>
      ),
    },`;

if (content.includes(anchor)) {
  content = content.replace(anchor, inject);
  fs.writeFileSync(path, content);
  console.log("Settings patched successfully.");
} else {
  console.log("Could not find anchor");
}
