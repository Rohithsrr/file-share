import bcrypt from "bcryptjs";

// Test code generator
function generateShareCode() {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}

function isValidShareCode(code) {
  return /^[a-zA-Z0-9]{6}$/.test(code);
}

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function sanitizeFilename(filename) {
  const cleanName = filename.replace(/[/\\?%*:|"<>]/g, "-").trim();
  return cleanName || "unnamed_file";
}

async function runTests() {
  console.log("=== 1. Testing Code Generation & Validation ===");
  for (let i = 0; i < 5; i++) {
    const code = generateShareCode();
    console.log(`Generated code: ${code}, valid: ${isValidShareCode(code)}`);
    if (!isValidShareCode(code)) throw new Error(`Code ${code} is invalid`);
  }
  if (isValidShareCode("ABC12")) throw new Error("Should fail short code");
  if (isValidShareCode("ABC1234")) throw new Error("Should fail long code");
  if (!isValidShareCode("9K3XYZ")) throw new Error("Should pass valid code");
  console.log("✓ Code generator tests passed.");

  console.log("\n=== 2. Testing Password Hashing & Comparison ===");
  const secret = "SuperSecretPassword123!";
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(secret, salt);
  console.log(`Bcrypt hash length: ${hash.length}, starts with: ${hash.substring(0, 7)}`);

  const matchCorrect = await bcrypt.compare(secret, hash);
  const matchWrong = await bcrypt.compare("WrongPassword", hash);
  if (!matchCorrect) throw new Error("Bcrypt comparison failed on correct password");
  if (matchWrong) throw new Error("Bcrypt comparison passed on wrong password");
  console.log("✓ Bcrypt password hashing & verification tests passed.");

  console.log("\n=== 3. Testing Rate Limiting Logic ===");
  const rateLimitMap = new Map();
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 10 * 60 * 1000;

  function recordFailed(id) {
    const now = Date.now();
    const rec = rateLimitMap.get(id) || { attempts: 0, firstAttemptTime: now };
    rec.attempts += 1;
    if (rec.attempts >= MAX_ATTEMPTS) {
      rec.lockedUntil = now + LOCKOUT_MS;
      rateLimitMap.set(id, rec);
      return { allowed: false, remainingAttempts: 0 };
    }
    rateLimitMap.set(id, rec);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - rec.attempts };
  }

  const testId = "192.168.1.1:XYZ789";
  for (let i = 1; i <= 4; i++) {
    const res = recordFailed(testId);
    if (!res.allowed) throw new Error("Should be allowed before 5 attempts");
  }
  const lockRes = recordFailed(testId);
  if (lockRes.allowed || lockRes.remainingAttempts !== 0) {
    throw new Error("5th attempt must lock out");
  }
  console.log("✓ Rate limiting simulation locked out after 5 attempts.");

  console.log("\n=== 4. Testing Filename Sanitization & Formats ===");
  console.log(`1024 bytes -> ${formatBytes(1024)}`);
  console.log(`25MB -> ${formatBytes(25 * 1024 * 1024)}`);
  console.log(`Sanitized name -> ${sanitizeFilename("../../../etc/passwd<>.png")}`);

  console.log("\n🎉 ALL LOGIC AND CRYPTO TESTS PASSED!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
