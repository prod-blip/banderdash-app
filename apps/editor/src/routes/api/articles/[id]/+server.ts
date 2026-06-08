import { json, type RequestHandler } from "@sveltejs/kit";
import { ArticleNotFoundError, ArticleVersionConflictError } from "@banderdash/backend/services/articles";
import { getEditorArticleService } from "$lib/server/article-service";

export const GET: RequestHandler = async ({ params }) => {
  const articleId = params.id;
  if (!articleId) {
    return json({ error: { code: "invalid_request", message: "article id is required." } }, { status: 400 });
  }

  try {
    const article = await getEditorArticleService().getArticle(articleId);
    return json(article);
  } catch (error) {
    return articleErrorResponse(error);
  }
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const articleId = params.id;
  if (!articleId) {
    return json({ error: { code: "invalid_request", message: "article id is required." } }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as { expectedVersion?: unknown; rawText?: unknown } | null;

  if (!payload || typeof payload.rawText !== "string" || !Number.isInteger(payload.expectedVersion)) {
    return json(
      { error: { code: "invalid_request", message: "rawText must be a string and expectedVersion must be an integer." } },
      { status: 400 }
    );
  }

  const expectedVersion = Number(payload.expectedVersion);

  try {
    const article = await getEditorArticleService().updateArticle(articleId, payload.rawText, expectedVersion);
    return json(article);
  } catch (error) {
    return articleErrorResponse(error);
  }
};

function articleErrorResponse(error: unknown): Response {
  if (error instanceof ArticleNotFoundError) {
    return json({ error: { code: "not_found", message: error.message } }, { status: 404 });
  }

  if (error instanceof ArticleVersionConflictError) {
    return json({ error: { code: "version_conflict", message: error.message } }, { status: 409 });
  }

  return json({ error: { code: "article_request_failed", message: formatErrorMessage(error) } }, { status: 400 });
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
