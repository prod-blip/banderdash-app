import { randomUUID } from "node:crypto";
import type { BanderdashDatabase } from "./db.js";

export const CANDIDATE_CONSENT_DECISIONS = ["approved", "rejected"] as const;
export type CandidateConsentDecision = (typeof CANDIDATE_CONSENT_DECISIONS)[number];

export interface CandidateConsentRecord {
  id: string;
  candidateId: string;
  articleId: string;
  documentVersion: number;
  decision: CandidateConsentDecision;
  createdAt: string;
}

export interface CandidateConsentServiceOptions {
  db: BanderdashDatabase;
  createId?: () => string;
  now?: () => Date;
}

export interface RecordCandidateConsentOptions {
  articleId: string;
  candidateId: string;
  decision: CandidateConsentDecision;
  expectedVersion: number;
}

export interface CandidateConsentService {
  recordConsent(options: RecordCandidateConsentOptions): Promise<CandidateConsentRecord>;
}

interface CandidateRow {
  article_id: string;
  document_version: number;
  invalidated_at: string | null;
  status: string;
}

interface ArticleRow {
  current_version: number;
}

export class CandidateConsentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidateConsentValidationError";
  }
}

export class CandidateConsentVersionConflictError extends Error {
  constructor(articleId: string, expectedVersion: number, currentVersion: number) {
    super(`Article ${articleId} is at version ${currentVersion}; reload before acting on version ${expectedVersion}.`);
    this.name = "CandidateConsentVersionConflictError";
  }
}

export function createCandidateConsentService(options: CandidateConsentServiceOptions): CandidateConsentService {
  const createId = options.createId ?? (() => `approval_${randomUUID()}`);
  const now = options.now ?? (() => new Date());

  return {
    async recordConsent(recordOptions: RecordCandidateConsentOptions): Promise<CandidateConsentRecord> {
      validateRecordOptions(recordOptions);

      const article = options.db.prepare("select current_version from articles where id = ?").get(recordOptions.articleId) as
        | ArticleRow
        | undefined;
      if (!article) {
        throw new CandidateConsentValidationError(`Article ${recordOptions.articleId} does not exist.`);
      }
      if (article.current_version !== recordOptions.expectedVersion) {
        throw new CandidateConsentVersionConflictError(recordOptions.articleId, recordOptions.expectedVersion, article.current_version);
      }

      const candidate = options.db
        .prepare("select article_id, document_version, status, invalidated_at from candidates where id = ?")
        .get(recordOptions.candidateId) as CandidateRow | undefined;

      if (!candidate) {
        throw new CandidateConsentValidationError(`Candidate ${recordOptions.candidateId} does not exist.`);
      }
      if (candidate.article_id !== recordOptions.articleId || candidate.document_version !== recordOptions.expectedVersion) {
        throw new CandidateConsentValidationError(`Candidate ${recordOptions.candidateId} does not match the current article version.`);
      }
      if (candidate.invalidated_at) {
        throw new CandidateConsentValidationError(`Candidate ${recordOptions.candidateId} was invalidated by an article edit.`);
      }
      if (candidate.status !== "survived") {
        throw new CandidateConsentValidationError(`Candidate ${recordOptions.candidateId} must survive Critic review before writer consent.`);
      }

      const createdAt = now().toISOString();
      const record: CandidateConsentRecord = {
        id: createId(),
        articleId: recordOptions.articleId,
        candidateId: recordOptions.candidateId,
        decision: recordOptions.decision,
        documentVersion: recordOptions.expectedVersion,
        createdAt
      };

      options.db
        .prepare(
          `insert into approvals (id, candidate_id, article_id, document_version, decision, payload_json, created_at)
            values (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          record.id,
          record.candidateId,
          record.articleId,
          record.documentVersion,
          record.decision,
          JSON.stringify(record),
          record.createdAt
        );

      return record;
    }
  };
}

function validateRecordOptions(options: RecordCandidateConsentOptions): void {
  if (!options.articleId.trim()) {
    throw new CandidateConsentValidationError("articleId is required.");
  }
  if (!options.candidateId.trim()) {
    throw new CandidateConsentValidationError("candidateId is required.");
  }
  if (!CANDIDATE_CONSENT_DECISIONS.includes(options.decision)) {
    throw new CandidateConsentValidationError("decision must be approved or rejected.");
  }
  if (!Number.isInteger(options.expectedVersion) || options.expectedVersion < 1) {
    throw new CandidateConsentValidationError("expectedVersion must be a positive integer.");
  }
}
