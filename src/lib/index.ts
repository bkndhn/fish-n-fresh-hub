/**
 * @fileoverview Main Library Barrel Export
 * @module lib
 * 
 * Provides unified, structured exports for Universal Retail Hub domain logic,
 * formatting helpers, financial engines, hardware drivers, and type definitions.
 */

// Core Domain Types
export * from "./types";

// Formatting & Localization
export * from "./format";

// Financial Accounting & P&L
export * from "./pnl";

// Hardware Drivers
export * from "./weighingScale";
export * from "./thermalPrinter";
export * from "./barcodeScanner";

// Multi-Branch & Tenant Isolation
export * from "./multiBranch";

// CSV & Catalog Operations
export * from "./retailCsv";

// Store Operating Schedule & Delivery SLAs
export * from "./storeSchedule";
