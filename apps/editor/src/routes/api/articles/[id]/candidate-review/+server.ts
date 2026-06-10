import { json, type RequestHandler } from "@sveltejs/kit";
import { runLocalCandidateReview } from "$lib/server/workflow-review";

export const POST: RequestHandler = async ({ params, request }) => {
  const articleId = params.id;
  const payload = (await request.json().catch(() => null)) as { expectedVersion?: unknown } | null;

  if (!articleId) {
    return json({ error: { code: "invalid_request", message: "Article id is required." } }, { status: 400 });
  }
  if (!payload || !Number.isInteger(payload.expectedVersion) || Number(payload.expectedVersion) < 1) {
    return json({ error: { code: "invalid_request", message: "expectedVersion must be a positive integer." } }, { status: 400 });
  }

  try {
    const result = await runLocalCandidateReview(articleId, Number(payload.expectedVersion));
    return json(result);
  } catch (error) {
    return json({ error: { code: "candidate_review_failed", message: formatErrorMessage(error) } }, { status: 400 });
  }
};

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
