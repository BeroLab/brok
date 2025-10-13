import { PrismaClient } from "../generated/prisma";
import { ObjectId } from "bson";
import type { InjectionDetectionResult } from "./prompt-injection-detector";
import type { SanitizationResult } from "./input-sanitizer";

export interface SecurityLogData {
  userId: string;
  username: string;
  channelId: string;
  originalMessage: string;
  detectionResult: InjectionDetectionResult;
  sanitizationResult: SanitizationResult;
}

export async function logInjectionAttempt(
  prisma: PrismaClient,
  data: SecurityLogData
): Promise<void> {
  try {
    await prisma.injectionAttempt.create({
      data: {
        id: new ObjectId().toString(),
        userId: data.userId,
        username: data.username,
        channelId: data.channelId,
        originalMessage: data.originalMessage,
        sanitizedMessage: data.sanitizationResult.sanitizedMessage,
        detectionScore: data.detectionResult.score,
        severity: data.detectionResult.severity,
        detectedPatterns: data.detectionResult.patterns,
        removedPatterns: data.sanitizationResult.removedPatterns,
        wasBlocked: data.detectionResult.severity === "high",
      },
    });

    console.log(
      `🚨 Security: Logged injection attempt by ${data.username} (score: ${data.detectionResult.score}, severity: ${data.detectionResult.severity})`
    );
  } catch (error) {
    console.error("Failed to log injection attempt:", error);
  }
}

export async function getUserInjectionAttemptCount(
  prisma: PrismaClient,
  userId: string,
  hoursWindow = 24
): Promise<number> {
  const cutoffDate = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);

  try {
    const count = await prisma.injectionAttempt.count({
      where: {
        userId,
        createdAt: {
          gte: cutoffDate,
        },
      },
    });

    return count;
  } catch (error) {
    console.error("Failed to get user injection attempt count:", error);
    return 0;
  }
}
