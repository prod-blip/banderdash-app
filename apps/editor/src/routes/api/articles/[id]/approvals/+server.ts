import { json, type RequestHandler } from "@sveltejs/kit";
import { CANDIDATE_CONSENT_DECISIONS, CandidateConsentVersionConflictError } from "@banderdash/backend/services/candidateConsent";
import { recordCandidateConsent } from "$lib/server/workflow-review";

export const POST: RequestHandler = async ({ params, request }) => {
  const articleId = params.id;
  const payload = (await request.json().catch(() => null)) as {
    candidateId?: unknown;
    decision?: unknown;
    expectedVersion?: unknown;
  } | null;

  if (!articleId) {
    return json({ error: { code: "invalid_request", message: "Article id is required." } }, { status: 400 });
  }
  if (!payload || typeof payload.candidateId !== "string" || payload.candidateId.trim().length === 0) {
    return json({ error: { code: "invalid_request", message: "candidateId must be a non-empty string." } }, { status: 400 });
  }
  if (!CANDIDATE_CONSENT_DECISIONS.includes(payload.decision as never)) {
    return json({ error: { code: "invalid_request", message: "decision must be approved or rejected." } }, { status: 400 });
  }
  if (!Number.isInteger(payload.expectedVersion) || Number(payload.expectedVersion) < 1) {
    return json({ error: { code: "invalid_request", message: "expectedVersion must be a positive integer." } }, { status: 400 });
  }

  try {
    const consent = await recordCandidateConsent({
      articleId,
      candidateId: payload.candidateId,
      decision: payload.decision as "approved" | "rejected",
      expectedVersion: Number(payload.expectedVersion)
    });
    return json(consent, { status: 201 });
  } catch (error) {
    return json(
      { error: { code: error instanceof CandidateConsentVersionConflictError ? "version_conflict" : "candidate_consent_failed", message: formatErrorMessage(error) } },
      { status: error instanceof CandidateConsentVersionConflictError ? 409 : 400 }
    );
  }
};

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
