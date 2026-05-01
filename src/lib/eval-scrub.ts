/**
 * PII scrubber for eval capture.
 * Zero-dependency. Based on GBrain's eval-capture-scrub.ts (v0.25.0).
 *
 * Scrubs: emails, phone numbers, SSNs, Luhn-valid credit cards, JWTs.
 * Returns { scrubbed, changes } — changes is count of replacements.
 */

const EMAIL_RE = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const PHONE_RE = /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const JWT_RE = /\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g;

/** Credit card patterns with Luhn check. Matches 13-19 digit sequences. */
const CC_CANDIDATE_RE = /\b(?:\d[ -]*?){13,19}\b/g;

function luhnCheck(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export interface ScrubResult {
  scrubbed: string;
  changes: number;
}

export function scrubPII(text: string): ScrubResult {
  if (!text) return { scrubbed: text, changes: 0 };
  let result = text;
  let changes = 0;

  // Emails → [EMAIL]
  const emailCount = (result.match(EMAIL_RE) || []).length;
  if (emailCount > 0) {
    result = result.replace(EMAIL_RE, "[EMAIL]");
    changes += emailCount;
  }

  // Phones → [PHONE]
  const phoneMatches = result.match(PHONE_RE) || [];
  result = result.replace(PHONE_RE, "[PHONE]");
  changes += phoneMatches.length;

  // SSNs → [SSN]
  const ssnMatches = result.match(SSN_RE) || [];
  result = result.replace(SSN_RE, "[SSN]");
  changes += ssnMatches.length;

  // JWTs → [JWT]
  const jwtMatches = result.match(JWT_RE) || [];
  result = result.replace(JWT_RE, "[JWT]");
  changes += jwtMatches.length;

  // Credit cards with Luhn check → [CC]
  const ccMatches = result.match(CC_CANDIDATE_RE) || [];
  let ccCount = 0;
  for (const match of ccMatches) {
    const digits = match.replace(/[^0-9]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnCheck(digits)) {
      result = result.replace(match, "[CC]");
      ccCount++;
    }
  }
  changes += ccCount;

  return { scrubbed: result, changes };
}

/**
 * Scrub an object's string values in place.
 * Handles nested objects and arrays.
 */
export function scrubObject(obj: Record<string, unknown>): { scrubbed: Record<string, unknown>; changes: number } {
  let totalChanges = 0;
  const scrubbed = JSON.parse(JSON.stringify(obj));

  function walk(val: any): any {
    if (typeof val === "string") {
      const r = scrubPII(val);
      totalChanges += r.changes;
      return r.scrubbed;
    }
    if (Array.isArray(val)) return val.map(walk);
    if (val && typeof val === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) {
        out[k] = walk(v);
      }
      return out;
    }
    return val;
  }

  return { scrubbed: walk(scrubbed), changes: totalChanges };
}
