import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, FileCode, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export interface ExportColumn {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "center" | "right";
  type?: "string" | "number" | "currency" | "date";
  format?: (value: any, row: any) => string;
}

export interface ExportOptions {
  filename: string;
  sheetName?: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
  orientation?: "portrait" | "landscape";
}

function escapeXml(unsafe: any): string {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Universal Excel Exporter (.xlsx SpreadsheetML XML)
 * Automatically calculates column widths and applies styled headers.
 */
export function exportToExcel({
  filename,
  sheetName = "Sheet1",
  title,
  subtitle,
  columns,
  data,
}: ExportOptions): void {
  try {
    const cleanFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;

    // Calculate dynamic column widths based on maximum cell content
    const colWidths = columns.map((col) => {
      if (col.width) return col.width;
      const maxLen = Math.max(
        col.label.length,
        ...data.map((row) => {
          const val = col.format ? col.format(row[col.key], row) : row[col.key];
          return val ? String(val).length : 0;
        })
      );
      return Math.max(75, Math.min(320, maxLen * 8.5 + 24));
    });

    const rowsXml: string[] = [];

    // Title Row
    rowsXml.push(`
      <Row ss:Height="24">
        <Cell ss:MergeAcross="${columns.length - 1}" ss:StyleID="Title">
          <Data ss:Type="String">${escapeXml(title)}</Data>
        </Cell>
      </Row>
    `);

    // Subtitle Row
    if (subtitle) {
      rowsXml.push(`
        <Row ss:Height="18">
          <Cell ss:MergeAcross="${columns.length - 1}" ss:StyleID="Subtitle">
            <Data ss:Type="String">${escapeXml(subtitle)}</Data>
          </Cell>
        </Row>
      `);
    }

    // Blank Spacing Row
    rowsXml.push(`<Row ss:Height="10"/>`);

    // Header Row
    const headerCells = columns
      .map(
        (col) => `
        <Cell ss:StyleID="Header">
          <Data ss:Type="String">${escapeXml(col.label)}</Data>
        </Cell>
      `
      )
      .join("");
    rowsXml.push(`<Row ss:Height="22">${headerCells}</Row>`);

    // Data Rows
    data.forEach((row, idx) => {
      const isEven = idx % 2 === 0;
      const rowStyle = isEven ? "RowEven" : "RowOdd";
      const cells = columns
        .map((col) => {
          const rawVal = row[col.key];
          const formattedVal = col.format ? col.format(rawVal, row) : rawVal;

          let cellType = "String";
          let cellStyle = rowStyle;
          let cellVal = formattedVal ?? "";

          if (col.type === "number" && typeof rawVal === "number" && !isNaN(rawVal)) {
            cellType = "Number";
            cellStyle = isEven ? "NumberEven" : "NumberOdd";
            cellVal = rawVal;
          } else if (col.type === "currency" && typeof rawVal === "number") {
            cellType = "Number";
            cellStyle = isEven ? "CurrencyEven" : "CurrencyOdd";
            cellVal = rawVal;
          }

          return `
            <Cell ss:StyleID="${cellStyle}">
              <Data ss:Type="${cellType}">${escapeXml(cellVal)}</Data>
            </Cell>
          `;
        })
        .join("");

      rowsXml.push(`<Row ss:Height="18">${cells}</Row>`);
    });

    const columnsXml = colWidths.map((w) => `<Column ss:Width="${Math.round(w)}"/>`).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${escapeXml(title)}</Title>
    <Author>Fish N Fresh Hub</Author>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#0F766E"/>
      <Alignment ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="Subtitle">
      <Font ss:FontName="Segoe UI" ss:Size="9" ss:Italic="1" ss:Color="#64748B"/>
      <Alignment ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0F766E" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0D9488"/>
      </Borders>
    </Style>
    <Style ss:ID="RowEven">
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="RowOdd">
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="NumberEven">
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="NumberOdd">
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="CurrencyEven">
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <NumberFormat ss:Format="&quot;₹&quot;#,##0.00"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="CurrencyOdd">
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <NumberFormat ss:Format="&quot;₹&quot;#,##0.00"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(sheetName)}">
    <Table>
      ${columnsXml}
      ${rowsXml.join("")}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <Selected/>
      <ProtectObjects>False</ProtectObjects>
      <ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = cleanFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Excel file downloaded: ${cleanFilename}`);
  } catch (err: any) {
    toast.error(`Excel export failed: ${err?.message || "Unknown error"}`);
  }
}

/**
 * Universal PDF Table Exporter
 * Generates an auto-fit vector PDF table document and opens the browser print/save preview.
 */
export function exportToPdfTable({
  title,
  subtitle,
  columns,
  data,
  orientation = "portrait",
}: ExportOptions): void {
  try {
    const printDate = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const headerHtml = columns
      .map((col) => {
        const align = col.align || (col.type === "number" || col.type === "currency" ? "right" : "left");
        return `<th style="text-align: ${align};">${escapeXml(col.label)}</th>`;
      })
      .join("");

    const rowsHtml = data
      .map((row, idx) => {
        const cells = columns
          .map((col) => {
            const align = col.align || (col.type === "number" || col.type === "currency" ? "right" : "left");
            const rawVal = row[col.key];
            const formatted = col.format ? col.format(rawVal, row) : rawVal ?? "-";
            return `<td style="text-align: ${align};">${escapeXml(formatted)}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(title)}</title>
  <style>
    @page {
      size: A4 ${orientation};
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10px;
      line-height: 1.4;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f766e;
      letter-spacing: -0.02em;
      margin: 0;
    }
    .report-title {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      margin: 2px 0 0 0;
    }
    .report-subtitle {
      font-size: 9px;
      color: #64748b;
      margin: 2px 0 0 0;
    }
    .meta-box {
      text-align: right;
      font-size: 8.5px;
      color: #64748b;
    }
    .badge {
      display: inline-block;
      background: #f0fdfa;
      color: #0f766e;
      border: 1px solid #ccfbf1;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
      margin-bottom: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    th {
      background-color: #f1f5f9;
      color: #334155;
      font-weight: 700;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      font-size: 9px;
      word-break: break-word;
    }
    tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .footer {
      margin-top: 14px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div>
      <div class="brand-title">FISH N FRESH HUB</div>
      <div class="report-title">${escapeXml(title)}</div>
      ${subtitle ? `<div class="report-subtitle">${escapeXml(subtitle)}</div>` : ""}
    </div>
    <div class="meta-box">
      <div class="badge">Total Records: ${data.length}</div>
      <div>Printed on: ${printDate}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>${headerHtml}</tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <span>Fish N Fresh Hub Management &amp; Retail Operations</span>
    <span>Confidential &amp; Proprietary</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      throw new Error("Unable to open print frame");
    }
    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Clean up iframe after print dialog closes
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {}
    }, 60000);

    toast.success("PDF document opened for print/download");
  } catch (err: any) {
    toast.error(`PDF export failed: ${err?.message || "Unknown error"}`);
  }
}

/**
 * Universal CSV Exporter with UTF-8 BOM
 */
export function exportToCsv({ filename, columns, data }: ExportOptions): void {
  try {
    const cleanFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    const headers = columns.map((col) => `"${col.label.replace(/"/g, '""')}"`);

    const rows = data.map((row) =>
      columns
        .map((col) => {
          const rawVal = row[col.key];
          const val = col.format ? col.format(rawVal, row) : rawVal ?? "";
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    // Add UTF-8 BOM (\uFEFF) for Excel Indian currency & Unicode support
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = cleanFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`CSV file downloaded: ${cleanFilename}`);
  } catch (err: any) {
    toast.error(`CSV export failed: ${err?.message || "Unknown error"}`);
  }
}

/**
 * Universal Dropdown Component for Exporting
 */
export function ExportDropdown({
  options,
  buttonLabel = "Export",
  size = "sm",
  variant = "outline",
  className = "",
}: {
  options: ExportOptions;
  buttonLabel?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} className={`rounded-xl text-xs gap-1.5 font-medium ${className}`}>
          <Download className="size-3.5" />
          <span>{buttonLabel}</span>
          <ChevronDown className="size-3 opacity-60 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border border-border/80 p-1">
        <DropdownMenuItem
          onClick={() => exportToExcel(options)}
          className="rounded-lg text-xs py-2 cursor-pointer flex items-center gap-2"
        >
          <FileSpreadsheet className="size-4 text-emerald-600" />
          <div className="flex flex-col">
            <span className="font-semibold">Excel Spreadsheet</span>
            <span className="text-[10px] text-muted-foreground">Auto-width .xlsx format</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => exportToPdfTable(options)}
          className="rounded-lg text-xs py-2 cursor-pointer flex items-center gap-2"
        >
          <FileText className="size-4 text-rose-600" />
          <div className="flex flex-col">
            <span className="font-semibold">PDF Document</span>
            <span className="text-[10px] text-muted-foreground">Print or Save as Vector PDF</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => exportToCsv(options)}
          className="rounded-lg text-xs py-2 cursor-pointer flex items-center gap-2"
        >
          <FileCode className="size-4 text-blue-600" />
          <div className="flex flex-col">
            <span className="font-semibold">CSV File</span>
            <span className="text-[10px] text-muted-foreground">UTF-8 comma separated</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
