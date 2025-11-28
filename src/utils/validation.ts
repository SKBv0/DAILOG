const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

export function sanitizeInput(input: string | null | undefined): string {
  if (!input) {
    return "";
  }

  return input.replace(/[&<>"'/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

export function validateDialogText(text: string, maxLength = 1000): {
  isValid: boolean;
  error?: string;
  sanitized: string;
} {
  const sanitized = sanitizeInput(text);

  if (!sanitized.trim()) {
    return { isValid: false, error: "Text is required", sanitized: "" };
  }

  if (sanitized.length > maxLength) {
    return {
      isValid: false,
      error: `Text exceeds maximum length of ${maxLength} characters`,
      sanitized: sanitized.slice(0, maxLength),
    };
  }

  return { isValid: true, sanitized };
}

export function validateNodeId(id: string): boolean {
  if (!id) return false;
  return /^[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9]+$/.test(id);
}

export function validateTag(tag: Partial<{ id: string; label: string; metadata?: { importance?: number } }>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!tag.id || typeof tag.id !== "string") {
    errors.push("Tag ID is required");
  }

  if (!tag.label || typeof tag.label !== "string") {
    errors.push("Tag label is required");
  }

  const importance = tag.metadata?.importance;
  if (importance !== undefined && (importance < 1 || importance > 5)) {
    errors.push("Tag importance must be between 1 and 5");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateProjectType(projectType: string | null | undefined): boolean {
  return projectType === "game" || projectType === "interactive_story" || projectType === "novel";
}

export function validateApiResponse(response: any): { isValid: boolean; error?: string } {
  if (!response) {
    return { isValid: false, error: "Empty response" };
  }

  if (response.error) {
    return { isValid: false, error: response.error };
  }

  return { isValid: true };
}

export function validateConnection(connection: { source?: string; target?: string } | null | undefined): boolean {
  if (!connection || !connection.source || !connection.target) {
    return false;
  }

  if (connection.source === connection.target) {
    return false;
  }

  return true;
}

export function validateNumber(
  value: string | number,
  min?: number,
  max?: number
): { isValid: boolean; value?: number; error?: string } {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return { isValid: false, error: "Invalid number" };
  }

  if (typeof min === "number" && parsed < min) {
    return { isValid: false, value: min };
  }

  if (typeof max === "number" && parsed > max) {
    return { isValid: false, value: max };
  }

  return { isValid: true, value: parsed };
}

