export interface InjectionDetectionResult {
  isSuspicious: boolean;
  score: number;
  patterns: string[];
  severity: "low" | "medium" | "high";
}

const INJECTION_PATTERNS = [
  {
    pattern: /esqueç(a|e|o)|ignore|desconsidere/gi,
    weight: 3,
    description: "forget_ignore_instructions",
  },
  {
    pattern: /instruç(õ|ã|ô|o)es (anteriores|passadas|pr(é|e)vias)/gi,
    weight: 3,
    description: "previous_instructions",
  },
  {
    pattern: /voc(ê|e) (agora (é|e)|ser(á|a))/gi,
    weight: 2,
    description: "role_override",
  },
  {
    pattern: /(seu|teu) (novo|pr(ó|o)ximo) (papel|objetivo|prop(ó|o)sito)/gi,
    weight: 2,
    description: "role_redefinition",
  },
  {
    pattern: /<\s*(system|admin|root|assistant|instruction)[\s>]/gi,
    weight: 4,
    description: "fake_system_tags",
  },
  {
    pattern: /\[SYSTEM\]|\[ADMIN\]|\[INSTRUCTION\]/gi,
    weight: 4,
    description: "fake_system_brackets",
  },
  {
    pattern: /fale mal|xingar|ofender|insultar/gi,
    weight: 2,
    description: "malicious_intent",
  },
  {
    pattern: /(delete|remova|apague) (todas|seus) (mem(ó|o)rias|dados|informa(ç|c)(õ|o)es)/gi,
    weight: 3,
    description: "data_deletion",
  },
  {
    pattern: /from now on|a partir de agora|daqui pra frente/gi,
    weight: 2,
    description: "behavioral_override",
  },
  {
    pattern: /repita|copie|echo/gi,
    weight: 1,
    description: "data_extraction",
  },
];

const SUSPICIOUS_REPETITIONS = {
  maxRepeatedChars: 15,
  weight: 1,
};

export function detectPromptInjection(
  message: string
): InjectionDetectionResult {
  let score = 0;
  const detectedPatterns: string[] = [];

  for (const { pattern, weight, description } of INJECTION_PATTERNS) {
    const matches = message.match(pattern);
    if (matches) {
      score += weight * matches.length;
      detectedPatterns.push(description);
    }
  }

  const repeatedCharsPattern = /(.)\1{15,}/g;
  if (repeatedCharsPattern.test(message)) {
    score += SUSPICIOUS_REPETITIONS.weight;
    detectedPatterns.push("suspicious_repetition");
  }

  const hasMultipleSystemTags =
    (message.match(/<\/?[a-z]+>/gi) || []).length > 3;
  if (hasMultipleSystemTags) {
    score += 2;
    detectedPatterns.push("multiple_xml_tags");
  }

  let severity: "low" | "medium" | "high" = "low";
  if (score >= 8) {
    severity = "high";
  } else if (score >= 4) {
    severity = "medium";
  }

  return {
    isSuspicious: score >= 4,
    score,
    patterns: [...new Set(detectedPatterns)],
    severity,
  };
}
