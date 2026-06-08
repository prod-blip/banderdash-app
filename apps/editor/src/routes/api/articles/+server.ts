import { json, type RequestHandler } from "@sveltejs/kit";
import { getEditorArticleService } from "$lib/server/article-service";

export const POST: RequestHandler = async ({ request }) => {
  const payload = (await request.json().catch(() => null)) as { rawText?: unknown } | null;

  if (!payload || typeof payload.rawText !== "string") {
    return json({ error: { code: "invalid_request", message: "rawText must be a string." } }, { status: 400 });
  }

  try {
    const article = await getEditorArticleService().createArticle(payload.rawText);
    return json(article, { status: 201 });
  } catch (error) {
    return json(
      { error: { code: "article_create_failed", message: formatErrorMessage(error) } },
      { status: 400 }
    );
  }
};

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
