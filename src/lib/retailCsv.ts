import type { Product } from "./types";

export interface ParsedCsvResult {
  validProducts: Partial<Product>[];
  errors: string[];
}

export const CSV_HEADERS = [
  "name",
  "category",
  "cost_price",
  "price",
  "old_price",
  "unit",
  "stock",
  "brand",
  "model_number",
  "warranty_period_months",
  "requires_serial",
  "aisle_location",
  "specifications",
  "pos_code",
  "description",
];

/**
 * Generate sample CSV template tailored to business industry
 */
export function generateSampleCsv(vertical: string = "electronics_appliances"): string {
  const headerLine = CSV_HEADERS.join(",");
  let sampleRows: string[] = [];

  if (vertical === "electronics_appliances") {
    sampleRows = [
      'Apple iPhone 15 128GB,Smartphones & Tablets,68000,79900,82900,pc,15,Apple,A3090,12,true,"Aisle 1, Shelf A-1","RAM: 6GB | Storage: 128GB | Display: 6.1-inch Super Retina | Chip: A16 Bionic",101,"Flagship Apple smartphone with Dynamic Island and 48MP main camera"',
      'Samsung 55-inch 4K Crystal UHD TV,Smart TVs & Home Theatre,35000,44990,52900,pc,8,Samsung,UA55CUE60AK,24,true,"Aisle 2, Rack TV-3","Screen: 55 inch | Resolution: 4K UHD | Refresh: 60Hz | Audio: 20W Dolby",102,"Immersive crystal 4K display with smart Tizen OS"',
      'Dell Inspiron 15 Core i5,Laptops & Computers,43000,54990,62000,pc,12,Dell,Inspiron-3520,12,true,"Aisle 1, Shelf B-2","CPU: Intel i5 12th Gen | RAM: 16GB | SSD: 512GB NVMe | Screen: 15.6-inch FHD",103,"High-speed performance laptop for work and productivity"',
      'Boat Rockerz 450 Bluetooth Headphone,Audio & Headphones,950,1499,3990,pc,50,boAt,Rockerz-450,12,false,"Aisle 3, Bin H-1","Battery: 15 Hours | Driver: 40mm | Bluetooth: v5.0",104,"Wireless on-ear headphone with HD sound and comfortable ear cushions"',
    ];
  } else if (vertical === "clothing_fashion") {
    sampleRows = [
      'Men Pure Cotton Slim Fit Oxford Shirt,Men Casual & Formal,750,1299,1999,pc,40,Allen Solly,AS-SH-01,0,false,"Aisle A, Rack 2","Fabric: 100% Pure Cotton | Fit: Slim Fit | Sleeve: Full Sleeve | Pattern: Solid",201,"Classic breathable cotton shirt suitable for formal and casual wear"',
      'Women Printed Rayon Anarkali Kurti,Women Ethnic & Western,480,899,1599,pc,60,Biba,BB-AK-09,0,false,"Aisle B, Rack 1","Fabric: Premium Rayon | Length: Calf Length | Neck: Round Neck | Sleeve: 3/4th",202,"Elegant ethnic festive wear with gold foil print accents"',
      'Men Slim Straight Stretch Denim Jeans,Men Casual & Formal,1050,1799,2999,pc,35,Levi\'s,511-SLIM,0,false,"Aisle A, Rack 4","Fabric: Cotton Stretch Denim | Waist: Mid Rise | Closure: Button & Zip",203,"Durable stretch denim engineered for all-day flexibility"',
    ];
  } else if (vertical === "grocery_supermarket") {
    sampleRows = [
      'Aashirvaad Shudh Chakki Atta 10kg,Atta Rice & Whole Grains,385,445,495,pack,100,Aashirvaad,AASH-10KG,0,false,"Aisle 1, Pallet 3","Type: 100% Whole Wheat | Fibre: High Fibre | Shelf Life: 3 Months",301,"Pure whole wheat flour processed with traditional stone chakki grinding"',
      'Tata Sampann Unpolished Toor Dal 1kg,Dals Pulses & Dry Fruits,138,175,195,kg,80,Tata Sampann,TS-TOOR-1K,0,false,"Aisle 2, Shelf D-2","Protein: 22g per 100g | Polish: Unpolished Natural",302,"Rich in dietary protein without any chemical polishing or coloring"',
      'Fortune Sunlite Refined Sunflower Oil 1L,Edible Oils & Ghee,115,135,160,pack,120,Fortune,FORT-SUN-1L,0,false,"Aisle 3, Shelf B-1","Enriched: Vitamin A & D | Zero Cholesterol",303,"Light and healthy edible cooking oil for everyday family meals"',
      'Amul Butter Pasteurised 500g,Dairy Bread & Eggs,235,275,285,pack,50,Amul,AMUL-BUT-500,0,false,"Dairy Chiller #1","Milk Fat: 80% | Storage: Refrigerate 4°C",304,"The classic Taste of India butter made from pure fresh cream"',
    ];
  } else {
    // Universal / Departmental
    sampleRows = [
      'Samsung 43-inch 4K Smart TV,Electronics,22500,29990,36900,pc,10,Samsung,UA43CUE,24,true,"Aisle 1, Rack 1","Display: 4K UHD | Audio: 20W",401,"Crystal UHD smart entertainment display"',
      'Men Classic Polo T-Shirt,Fashion & Apparel,380,699,1199,pc,50,U.S. Polo,USP-PL-01,0,false,"Aisle 2, Rack 3","Fabric: 100% Cotton | Fit: Regular",402,"Everyday breathable pique polo"',
      'Daawat Rozana Gold Basmati Rice 5kg,Groceries,320,410,480,pack,40,Daawat,DW-BAS-5K,0,false,"Aisle 3, Shelf A",,,,"Aged long grain aromatic basmati rice"',
    ];
  }

  return [headerLine, ...sampleRows].join("\n");
}

/**
 * Parse a CSV text into Product candidate records
 */
export function parseProductsCsv(csvText: string): ParsedCsvResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: string[] = [];
  const validProducts: Partial<Product>[] = [];

  if (lines.length < 2) {
    return { validProducts: [], errors: ["CSV file is empty or does not contain header and data rows."] };
  }

  const rawHeaders = splitCsvLine(lines[0] || "").map((h) => h.toLowerCase().trim().replace(/['"\s_]+/g, ""));

  const nameIdx = rawHeaders.findIndex((h) => h.includes("name") || h === "productname" || h === "title");
  const priceIdx = rawHeaders.findIndex((h) => (h === "price" || h === "mrp" || h === "rate" || h === "sellingprice") && !h.includes("old") && !h.includes("cost") && !h.includes("buy"));

  if (nameIdx === -1) {
    return { validProducts: [], errors: ["Mandatory column 'name' was not found in the CSV header."] };
  }
  if (priceIdx === -1) {
    return { validProducts: [], errors: ["Mandatory column 'price' was not found in the CSV header."] };
  }

  const catIdx = rawHeaders.findIndex((h) => h.includes("category"));
  const costPriceIdx = rawHeaders.findIndex((h) => h.includes("cost") || h.includes("buying") || h.includes("purchase"));
  const oldPriceIdx = rawHeaders.findIndex((h) => h.includes("old") || h.includes("original"));
  const unitIdx = rawHeaders.findIndex((h) => h === "unit");
  const stockIdx = rawHeaders.findIndex((h) => h === "stock" || h === "qty" || h === "quantity");
  const brandIdx = rawHeaders.findIndex((h) => h.includes("brand"));
  const modelIdx = rawHeaders.findIndex((h) => h.includes("model"));
  const warrantyIdx = rawHeaders.findIndex((h) => h.includes("warranty"));
  const serialIdx = rawHeaders.findIndex((h) => h.includes("serial") || h.includes("imei"));
  const aisleIdx = rawHeaders.findIndex((h) => h.includes("aisle") || h.includes("shelf") || h.includes("location"));
  const specsIdx = rawHeaders.findIndex((h) => h.includes("spec") || h.includes("attribute"));
  const posCodeIdx = rawHeaders.findIndex((h) => h.includes("pos") || h.includes("code"));
  const descIdx = rawHeaders.findIndex((h) => h.includes("desc"));

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i]?.trim();
    if (!rawLine) continue;

    const cols = splitCsvLine(rawLine);
    const rowNum = i + 1;

    const name = (cols[nameIdx] || "").trim();
    if (!name) {
      errors.push("Row " + rowNum + ": Missing product name. Skipped.");
      continue;
    }

    const priceNum = parseFloat(cols[priceIdx] || "0");
    if (isNaN(priceNum) || priceNum <= 0) {
      errors.push("Row " + rowNum + " (" + name + "): Invalid price '" + cols[priceIdx] + "'. Skipped.");
      continue;
    }

    const costPriceNum = costPriceIdx >= 0 && cols[costPriceIdx] ? parseFloat(cols[costPriceIdx]!) : null;
    const oldPriceNum = oldPriceIdx >= 0 && cols[oldPriceIdx] ? parseFloat(cols[oldPriceIdx]!) : null;
    const stockNum = stockIdx >= 0 && cols[stockIdx] ? parseFloat(cols[stockIdx]!) : 50;
    const warrantyMonths = warrantyIdx >= 0 && cols[warrantyIdx] ? parseInt(cols[warrantyIdx]!, 10) : 0;
    const posCode = posCodeIdx >= 0 && cols[posCodeIdx] ? parseInt(cols[posCodeIdx]!, 10) : null;

    let requiresSerial = false;
    if (serialIdx >= 0 && cols[serialIdx]) {
      const v = cols[serialIdx]!.toLowerCase().trim();
      requiresSerial = v === "true" || v === "1" || v === "yes" || v === "y";
    }

    let specifications: Record<string, string> = {};
    if (specsIdx >= 0 && cols[specsIdx]) {
      const rawSpec = cols[specsIdx]!.trim();
      if (rawSpec.startsWith("{") && rawSpec.endsWith("}")) {
        try {
          specifications = JSON.parse(rawSpec);
        } catch {
          // parse key:value | key2:value2
          specifications = parsePipeKeyValues(rawSpec);
        }
      } else {
        specifications = parsePipeKeyValues(rawSpec);
      }
    }

    const productCandidate: Partial<Product> = {
      name,
      price: priceNum,
      cost_price: costPriceNum && !isNaN(costPriceNum) ? costPriceNum : null,
      old_price: oldPriceNum && !isNaN(oldPriceNum) ? oldPriceNum : null,
      unit: unitIdx >= 0 && cols[unitIdx] ? cols[unitIdx]!.trim() : "pc",
      category: catIdx >= 0 && cols[catIdx] ? cols[catIdx]!.trim() : "General",
      stock: !isNaN(stockNum) ? stockNum : 50,
      brand: brandIdx >= 0 && cols[brandIdx] ? cols[brandIdx]!.trim() : null,
      model_number: modelIdx >= 0 && cols[modelIdx] ? cols[modelIdx]!.trim() : null,
      warranty_period_months: !isNaN(warrantyMonths) ? warrantyMonths : 0,
      requires_serial: requiresSerial,
      aisle_location: aisleIdx >= 0 && cols[aisleIdx] ? cols[aisleIdx]!.trim() : null,
      specifications: Object.keys(specifications).length > 0 ? specifications : null,
      pos_code: posCode && !isNaN(posCode) ? posCode : null,
      description: descIdx >= 0 && cols[descIdx] ? cols[descIdx]!.trim() : null,
      is_available: true,
      is_featured: false,
    };

    validProducts.push(productCandidate);
  }

  return { validProducts, errors };
}

/**
 * Export products to standard CSV string
 */
export function exportProductsToCsv(products: Product[]): string {
  const header = CSV_HEADERS.join(",");
  const rows = products.map((p) => {
    const specsStr = p.specifications
      ? Object.entries(p.specifications)
          .map(([k, v]) => k + ": " + v)
          .join(" | ")
      : "";

    const values = [
      escapeCsvCell(p.name),
      escapeCsvCell(p.category || "General"),
      p.cost_price ?? "",
      p.price,
      p.old_price ?? "",
      escapeCsvCell(p.unit || "pc"),
      p.stock,
      escapeCsvCell(p.brand || ""),
      escapeCsvCell(p.model_number || ""),
      p.warranty_period_months || 0,
      p.requires_serial ? "true" : "false",
      escapeCsvCell(p.aisle_location || ""),
      escapeCsvCell(specsStr),
      p.pos_code ?? "",
      escapeCsvCell(p.description || ""),
    ];
    return values.join(",");
  });

  return [header, ...rows].join("\n");
}

function escapeCsvCell(val: string): string {
  if (!val) return "";
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parsePipeKeyValues(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const pairs = raw.split("|");
  for (const pair of pairs) {
    const idx = pair.indexOf(":");
    if (idx > 0) {
      const k = pair.substring(0, idx).trim();
      const v = pair.substring(idx + 1).trim();
      if (k && v) out[k] = v;
    }
  }
  return out;
}
