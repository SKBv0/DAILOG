import { migrateToV2, MigrationError } from "../domain/migrate";
import { validateProject, ValidationErrorType } from "../domain/validate";
import { ProjectV2 } from "../domain/schema";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_NODES = 10000;
const MAX_EDGES = 20000;

interface ImportWorkerRequest {
  type: "import";
  data: string;
  fileName?: string;
}

interface ImportSuccessResponse {
  success: true;
  project: ProjectV2;
  migrationInfo?: {
    wasMigrated: boolean;
    fromVersion: string;
    toVersion: string;
  };
  validationResult: {
    isValid: boolean;
    errors: number;
    warnings: number;
  };
}

interface ImportFailureResponse {
  success: false;
  error: string;
  errorCode: string;
  details?: unknown;
}

type ImportWorkerResponse = ImportSuccessResponse | ImportFailureResponse;

const ErrorCodes = {
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_JSON: "INVALID_JSON",
  TOO_MANY_NODES: "TOO_MANY_NODES",
  TOO_MANY_EDGES: "TOO_MANY_EDGES",
  MIGRATION_FAILED: "MIGRATION_FAILED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  SECURITY_VIOLATION: "SECURITY_VIOLATION",
  CIRCULAR_REFERENCE: "CIRCULAR_REFERENCE",
  MALFORMED_DATA: "MALFORMED_DATA",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

function sanitizeJsonString(jsonString: string): string {
  const dangerousPatterns = [
    /<script[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /setTimeout\s*\(/gi,
    /setInterval\s*\(/gi,
  ];

  let sanitized = jsonString;
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, "");
  }

  return sanitized;
}

function hasCircularReferences(obj: any, seen = new WeakSet()): boolean {
  if (obj === null || typeof obj !== "object") {
    return false;
  }

  if (seen.has(obj)) {
    return true;
  }

  seen.add(obj);

  try {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (hasCircularReferences(obj[key], seen)) {
          return true;
        }
      }
    }
  } catch (error) {
    return false;
  }

  seen.delete(obj);
  return false;
}

function validateDataSize(data: any): { isValid: boolean; error?: string } {
  if (!data || typeof data !== "object") {
    return { isValid: false, error: "Invalid data format" };
  }

  const nodes = data.nodes || [];
  const edges = data.edges || data.connections || [];

  if (Array.isArray(nodes) && nodes.length > MAX_NODES) {
    return {
      isValid: false,
      error: `Too many nodes: ${nodes.length}. Maximum allowed: ${MAX_NODES}`,
    };
  }

  if (Array.isArray(edges) && edges.length > MAX_EDGES) {
    return {
      isValid: false,
      error: `Too many edges: ${edges.length}. Maximum allowed: ${MAX_EDGES}`,
    };
  }

  return { isValid: true };
}

async function processImport(request: ImportWorkerRequest): Promise<ImportWorkerResponse> {
  const { data: jsonString, fileName: _fileName } = request;

  try {
    if (jsonString.length > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File too large: ${jsonString.length} bytes. Maximum allowed: ${MAX_FILE_SIZE} bytes`,
        errorCode: ErrorCodes.FILE_TOO_LARGE,
      };
    }

    const sanitizedJson = sanitizeJsonString(jsonString);

    let parsedData: any;
    try {
      parsedData = JSON.parse(sanitizedJson);
    } catch (parseError) {
      return {
        success: false,
        error: "Invalid JSON format",
        errorCode: ErrorCodes.INVALID_JSON,
        details: parseError,
      };
    }

    if (hasCircularReferences(parsedData)) {
      return {
        success: false,
        error: "Circular references detected in data",
        errorCode: ErrorCodes.CIRCULAR_REFERENCE,
      };
    }

    const sizeValidation = validateDataSize(parsedData);
    if (!sizeValidation.isValid) {
      return {
        success: false,
        error: sizeValidation.error!,
        errorCode: sizeValidation.error!.includes("nodes")
          ? ErrorCodes.TOO_MANY_NODES
          : ErrorCodes.TOO_MANY_EDGES,
      };
    }

    let project: ProjectV2;
    let migrationInfo: ImportSuccessResponse["migrationInfo"];

    try {
      const originalVersion = parsedData.schemaVersion || "1.0.0";
      project = migrateToV2(parsedData);

      migrationInfo = {
        wasMigrated: originalVersion !== "2.0.0",
        fromVersion: originalVersion,
        toVersion: "2.0.0",
      };
    } catch (migrationError) {
      if (migrationError instanceof MigrationError) {
        return {
          success: false,
          error: migrationError.message,
          errorCode: ErrorCodes.MIGRATION_FAILED,
          details: migrationError.cause,
        };
      }

      return {
        success: false,
        error: "Migration failed with unknown error",
        errorCode: ErrorCodes.MIGRATION_FAILED,
        details: migrationError,
      };
    }

    const validationResult = validateProject(project);

    const criticalErrors = validationResult.errors.filter(
      (error) =>
        error.type === ValidationErrorType.EDGE_SOURCE_MISSING ||
        error.type === ValidationErrorType.EDGE_TARGET_MISSING ||
        error.type === ValidationErrorType.DUPLICATE_NODE_ID ||
        error.type === ValidationErrorType.DUPLICATE_EDGE_ID
    );

    if (criticalErrors.length > 0) {
      return {
        success: false,
        error: `Project has critical validation errors: ${criticalErrors.map((e) => e.message).join(", ")}`,
        errorCode: ErrorCodes.VALIDATION_FAILED,
        details: criticalErrors,
      };
    }

    return {
      success: true,
      project,
      migrationInfo,
      validationResult: {
        isValid: validationResult.isValid,
        errors: validationResult.errors.length,
        warnings: validationResult.warnings.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      errorCode: ErrorCodes.UNKNOWN_ERROR,
      details: error,
    };
  }
}

self.onmessage = async (event: MessageEvent<ImportWorkerRequest>) => {
  try {
    const response = await processImport(event.data);
    self.postMessage(response);
  } catch (error) {
    const errorResponse: ImportWorkerResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Worker processing failed",
      errorCode: ErrorCodes.UNKNOWN_ERROR,
      details: error,
    };
    self.postMessage(errorResponse);
  }
};

export type { ImportWorkerRequest, ImportWorkerResponse };
