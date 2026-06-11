import { StorageService } from "../modules/storage/storage.service";
import * as fs from "fs";
import * as path from "path";

// Parse .env.local manually
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

async function main() {
  const url = await StorageService.createPutUrl({
    key: "uploads/raw/test-headers.jpg",
    contentType: "image/jpeg",
    contentMd5: "1B2M2Y8AsgTpgAmY7PhCfg==",
  });
  console.log("Presigned URL:", url);
  
  const parsedUrl = new URL(url);
  console.log("Signed Headers:", parsedUrl.searchParams.get("X-Amz-SignedHeaders"));
}

main().catch(console.error);
