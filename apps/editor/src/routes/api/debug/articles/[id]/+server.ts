import { getDebugHistory } from "@banderdash/backend/services/debugHistory";
import { json, type RequestHandler } from "@sveltejs/kit";
import { getEditorDatabase } from "$lib/server/article-service";

export const GET: RequestHandler = async ({ params, url }) => {
  const articleId = params.id;
  const versionParam = url.searchParams.get("version");

  if (!articleId) {
    return json({ error: { code: "invalid_request", message: "Article id is required." } }, { status: 400 });
  }

  const documentVersion = versionParam === null ? undefined : Number(versionParam);
  if (typeof documentVersion === "number" && (!Number.isInteger(documentVersion) || documentVersion < 1)) {
    return json({ error: { code: "invalid_request", message: "version must be a positive integer." } }, { status: 400 });
  }

  try {
    return json(getDebugHistory({ articleId, db: getEditorDatabase(), documentVersion }));
  } catch (error) {
    return json({ error: { code: "debug_history_failed", message: formatErrorMessage(error) } }, { status: 400 });
  }
};

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
