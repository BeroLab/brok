export interface SanitizationResult {
  sanitizedMessage: string;
  wasModified: boolean;
  removedPatterns: string[];
}

const FAKE_SYSTEM_TAGS = [
  "system",
  "admin",
  "root",
  "assistant",
  "instruction",
  "ai",
  "prompt",
  "context",
];

const UNICODE_CONFUSABLES: Record<string, string> = {
  ẽ: "e",
  ã: "a",
  õ: "o",
  í: "i",
  ó: "o",
  á: "a",
  é: "e",
  ú: "u",
  ç: "c",
};

export function sanitizeInput(message: string): SanitizationResult {
  let sanitized = message;
  const removedPatterns: string[] = [];
  let wasModified = false;

  const tagPattern = new RegExp(
    `<\\s*/?\\s*(${FAKE_SYSTEM_TAGS.join("|")})\\s*[^>]*>`,
    "gi"
  );
  if (tagPattern.test(sanitized)) {
    sanitized = sanitized.replace(tagPattern, "");
    removedPatterns.push("fake_system_tags");
    wasModified = true;
  }

  const bracketPattern = /\[(SYSTEM|ADMIN|ROOT|INSTRUCTION|AI|PROMPT)\]/gi;
  if (bracketPattern.test(sanitized)) {
    sanitized = sanitized.replace(bracketPattern, "");
    removedPatterns.push("fake_system_brackets");
    wasModified = true;
  }

  const excessiveRepeatsPattern = /(.)\1{20,}/g;
  if (excessiveRepeatsPattern.test(sanitized)) {
    sanitized = sanitized.replace(excessiveRepeatsPattern, "$1$1$1");
    removedPatterns.push("excessive_repetition");
    wasModified = true;
  }

  const suspiciousNewlinesPattern = /\n{10,}/g;
  if (suspiciousNewlinesPattern.test(sanitized)) {
    sanitized = sanitized.replace(suspiciousNewlinesPattern, "\n\n");
    removedPatterns.push("excessive_newlines");
    wasModified = true;
  }

  return {
    sanitizedMessage: sanitized.trim(),
    wasModified,
    removedPatterns: [...new Set(removedPatterns)],
  };
}

export function normalizeUnicode(text: string): string {
  let normalized = text;

  for (const [confusable, replacement] of Object.entries(
    UNICODE_CONFUSABLES
  )) {
    normalized = normalized.replace(new RegExp(confusable, "g"), replacement);
  }

  return normalized;
}
