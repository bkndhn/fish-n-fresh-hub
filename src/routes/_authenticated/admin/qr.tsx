import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Download, Printer, Copy, MessageCircle } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORE_URL = "https://fishnfresh.lovable.app";

export const Route = createFileRoute("/_authenticated/admin/qr")({
  head: () => ({
    meta: [
      { title: "Storefront QR Code | Fish N Fresh Admin" },
      { name: "description", content: "Download, print and share the live storefront QR code." },
    ],
  }),
  component: StoreQrPage,
});

function StoreQrPage() {
  const [path, setPath] = useState("");
  const [png, setPng] = useState("");
  const [svg, setSvg] = useState("");
  const url = `${STORE_URL}${path ? (path.startsWith("/") ? path : `/${path}`) : ""}`;
  const message = `🐟 Fresh fish delivered to your door!\nOrder now from Fish N Fresh: ${url}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: "H" }).then(setPng);
    QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "H" }).then(setSvg);
  }, [url]);

  const download = (href: string, name: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
  };

  const printStandee = () => {
    const w = window.open("", "_blank");
    if (!w) return toast.error("Allow pop-ups to print");
    w.document.write(`<html><head><title>Fish N Fresh QR</title><style>
      body{font-family:system-ui,sans-serif;margin:0;display:flex;justify-content:center}
      .card{width:148mm;height:200mm;box-sizing:border-box;padding:14mm;text-align:center;border:2px solid #0284c7;border-radius:8mm;margin:6mm}
      h1{color:#0284c7;margin:0 0 4mm;font-size:30px} p{margin:2mm 0;font-size:16px}
      img{width:100mm;height:100mm;margin:6mm 0} .u{font-size:13px;color:#555}
      @page{size:A5;margin:0}</style></head><body><div class="card">
      <h1>Fish N Fresh</h1><p><b>Scan to order fresh seafood</b></p>
      <img src="${png}" onload="setTimeout(()=>print(),200)"/>
      <p>Home delivery · Pickup · UPI / Cash</p><p class="u">${url}</p></div></body></html>`);
    w.document.close();
  };

  return (
    <AdminShell title="Storefront QR Code">
      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border bg-card p-4 text-center">
          {png && <img src={png} alt="Storefront QR code" className="mx-auto w-full max-w-[280px]" />}
          <p className="mt-2 break-all text-xs text-muted-foreground">{url}</p>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="qr-path" className="text-sm font-medium">Open a specific page (optional)</label>
            <Input id="qr-path" placeholder="e.g. /offers or /catalog" value={path} onChange={(e) => setPath(e.target.value.trim())} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => download(png, "fishnfresh-qr.png")}><Download className="mr-1 size-4" />PNG</Button>
            <Button variant="outline" onClick={() => download(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, "fishnfresh-qr.svg")}><Download className="mr-1 size-4" />SVG</Button>
            <Button variant="outline" onClick={printStandee}><Printer className="mr-1 size-4" />Print standee (A5)</Button>
          </div>
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="whitespace-pre-line text-sm">{message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(message).then(() => toast.success("Copied"))}><Copy className="mr-1 size-4" />Copy message</Button>
              <Button size="sm" asChild><a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 size-4" />Share on WhatsApp</a></Button>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
