import { ProjectV2 } from "../domain/schema";
import { isFeatureEnabled } from "../config/features";
import { migrateToV2 } from "../domain/migrate";
import { validateProject } from "../domain/validate";
import logger from "../utils/logger";

export type ImportResult =
  | {
      success: true;
      project: ProjectV2;
      migrationInfo?: {
        wasMigrated: boolean;
        fromVersion: string;
        toVersion: string;
      };
      validationSummary: {
        isValid: boolean;
        errors: number;
        warnings: number;
      };
    }
  | {
      success: false;
      error: string;
      errorCode: string;
      userMessage: string;
    };

const ERROR_MESSAGES: Record<string, string> = {
  FILE_TOO_LARGE: "The file is too large. Please use a file smaller than 15MB.",
  INVALID_JSON: "The file is not a valid JSON format or is corrupted.",
  TOO_MANY_NODES: "The project has too many nodes. Maximum allowed is 10,000 nodes.",
  TOO_MANY_EDGES: "The project has too many connections. Maximum allowed is 20,000 connections.",
  MIGRATION_FAILED: "Failed to convert the project to the current format.",
  VALIDATION_FAILED: "The project has critical errors that prevent it from loading.",
  SECURITY_VIOLATION: "The file contains potentially unsafe content.",
  CIRCULAR_REFERENCE: "The file contains circular references and cannot be processed.",
  MALFORMED_DATA: "The project data is corrupted or incomplete.",
  UNKNOWN_ERROR: "An unexpected error occurred while importing the file.",
};

class ImportService {
  private worker: Worker | null = null;

  private async initWorker(): Promise<Worker> {
    if (!this.worker) {
      try {
        this.worker = new Worker(new URL("../workers/import.worker.ts", import.meta.url), {
          type: "module",
        });

        logger.debug("Import worker initialized");
      } catch (error) {
        logger.error("Failed to initialize import worker:", error);
        throw new Error("Failed to initialize import worker");
      }
    }
    return this.worker;
  }

  async importProject(jsonString: string, fileName?: string): Promise<ImportResult> {
    if (
      isFeatureEnabled("WORKER_IMPORT") &&
      typeof Worker !== "undefined" &&
      process.env.NODE_ENV !== "test"
    ) {
      return this.importWithWorker(jsonString, fileName);
    } else {
      return this.importWithoutWorker(jsonString, fileName);
    }
  }

  private async importWithWorker(jsonString: string, fileName?: string): Promise<ImportResult> {
    try {
      const worker = await this.initWorker();

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({
            success: false,
            error: "Import timeout",
            errorCode: "TIMEOUT",
            userMessage: "The import operation took too long and was cancelled.",
          });
        }, 30000);

        worker.onmessage = (event) => {
          clearTimeout(timeout);
          const response = event.data;

          if (response.success) {
            resolve({
              success: true,
              project: response.project,
              migrationInfo: response.migrationInfo,
              validationSummary: response.validationResult,
            });
          } else {
            resolve({
              success: false,
              error: response.error,
              errorCode: response.errorCode,
              userMessage: ERROR_MESSAGES[response.errorCode] || ERROR_MESSAGES.UNKNOWN_ERROR,
            });
          }
        };

        worker.onerror = (error) => {
          clearTimeout(timeout);
          logger.error("Worker error:", error);
          resolve({
            success: false,
            error: "Worker error",
            errorCode: "WORKER_ERROR",
            userMessage: "An error occurred while processing the file.",
          });
        };

        worker.postMessage({
          type: "import",
          data: jsonString,
          fileName: fileName || undefined,
        });
      });
    } catch (error) {
      logger.error("Failed to import with worker:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "WORKER_INIT_FAILED",
        userMessage: "Failed to initialize secure import. Please try again.",
      };
    }
  }

  private async importWithoutWorker(jsonString: string, _fileName?: string): Promise<ImportResult> {
    try {
      logger.info("Importing without worker (fallback mode)");

      if (jsonString.length > 15 * 1024 * 1024) {
        return {
          success: false,
          error: "File too large",
          errorCode: "FILE_TOO_LARGE",
          userMessage: ERROR_MESSAGES.FILE_TOO_LARGE,
        };
      }

      let parsedData: any;
      try {
        parsedData = JSON.parse(jsonString);
      } catch (parseError) {
        return {
          success: false,
          error: "Invalid JSON",
          errorCode: "INVALID_JSON",
          userMessage: ERROR_MESSAGES.INVALID_JSON,
        };
      }

      let project: ProjectV2;
      let migrationInfo: { wasMigrated: boolean; fromVersion: string; toVersion: string } | undefined;

      try {
        const originalVersion = parsedData.schemaVersion || "1.0.0";
        project = migrateToV2(parsedData);

        migrationInfo = {
          wasMigrated: originalVersion !== "2.0.0",
          fromVersion: originalVersion,
          toVersion: "2.0.0",
        };
      } catch (migrationError) {
        return {
          success: false,
          error: migrationError instanceof Error ? migrationError.message : "Migration failed",
          errorCode: "MIGRATION_FAILED",
          userMessage: ERROR_MESSAGES.MIGRATION_FAILED,
        };
      }

      const validationResult = validateProject(project);

      if (!validationResult.isValid) {
        const errorSummary = validationResult.errors.map((e) => `${e.type}: ${e.id}`).join(", ");
        logger.error(`Validation failed after import/migration: ${errorSummary}`);
        return {
          success: false,
          error: `Validation failed: ${errorSummary}`,
          errorCode: "VALIDATION_FAILED",
          userMessage: ERROR_MESSAGES.VALIDATION_FAILED,
        };
      }

      return {
        success: true,
        project,
        migrationInfo,
        validationSummary: {
          isValid: validationResult.isValid,
          errors: validationResult.errors.length,
          warnings: validationResult.warnings.length,
        },
      };
    } catch (error) {
      logger.error("Import without worker failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "UNKNOWN_ERROR",
        userMessage: ERROR_MESSAGES.UNKNOWN_ERROR,
      };
    }
  }

  async importFromFile(file: File): Promise<ImportResult> {
    try {
      if (file.type && !["application/json", "text/json", "text/plain"].includes(file.type)) {
        logger.warn(`Unexpected file type: ${file.type}`);
      }

      const text = await file.text();

      return this.importProject(text, file.name);
    } catch (error) {
      logger.error("Failed to read file:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read file",
        errorCode: "FILE_READ_ERROR",
        userMessage: "Failed to read the selected file.",
      };
    }
  }

  cleanup(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      logger.debug("Import worker terminated");
    }
  }
}

export const importService = new ImportService();

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    importService.cleanup();
  });
}
