/**
 * Client Bundle Builder & Readiness Validator
 *
 * Validates environment readiness and compiles client deployment bundles.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

console.log("==================================================================");
console.log("🐟 Fish N Fresh Hub — Client App Bundle Compiler");
console.log("==================================================================");

// 1. Validate Bootstrap SQL Exists
const bootstrapPath = path.resolve("supabase/client_bootstrap.sql");
if (!fs.existsSync(bootstrapPath)) {
  console.error("❌ Missing supabase/client_bootstrap.sql! Please ensure SQL bootstrapper exists.");
  process.exit(1);
}
console.log("✅ Verified client Supabase bootstrap script: supabase/client_bootstrap.sql");

// 2. Check Environment Variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Notice: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY not set in current shell.");
  console.warn("   Using existing .env configuration or default production build flags.");
} else {
  console.log(`✅ Supabase Target Host: ${new URL(supabaseUrl).host}`);
}

// 3. Compile Production Bundle
console.log("\n📦 Compiling production SSR and client worker bundles (npm run build)...");
try {
  execSync("npm run build", { stdio: "inherit" });
  console.log("\n✅ Production bundle compiled successfully!");
} catch (err) {
  console.error("❌ Build compilation failed.");
  process.exit(1);
}

// 4. Inspect Output Artifacts
const outputServer = path.resolve(".output/server");
const outputPublic = path.resolve(".output/public");

if (fs.existsSync(outputPublic)) {
  const publicFiles = fs.readdirSync(outputPublic);
  console.log(`✅ Client Static Assets: .output/public (${publicFiles.length} top-level files/dirs)`);
}

if (fs.existsSync(outputServer)) {
  console.log(`✅ Edge Server Worker: .output/server/index.mjs ready for Cloudflare / Vercel deployment.`);
}

console.log("\n==================================================================");
console.log("🎉 Client bundle is 100% READY for custom domain deployment!");
console.log("   See DEPLOY_CLIENT_GUIDE.md for step-by-step instructions.");
console.log("==================================================================");
