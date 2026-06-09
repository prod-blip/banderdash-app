import { randomUUID } from "node:crypto";
import { countWords, diffInvalidatedBlocks, isArticleDoc, parseBlocks, type ArticleDoc, type Block } from "@banderdash/doc-model";
import type { BanderdashDatabase } from "./db.js";

export interface ArticleServiceOptions {
  db: BanderdashDatabase;
  createId?: () => string;
  now?: () => Date;
}

export interface ArticleService {
  createArticle(rawText: string): Promise<ArticleDoc>;
  updateArticle(articleId: string, rawText: string, expectedVersion: number): Promise<ArticleDoc>;
  getArticle(articleId: string): Promise<ArticleDoc>;
}

interface ArticleRow {
  current_version: number;
  id: string;
}

interface ArticleVersionRow {
  payload_json: string;
}

export class ArticleNotFoundError extends Error {
  constructor(articleId: string) {
    super(`Article not found: ${articleId}`);
    this.name = "ArticleNotFoundError";
  }
}

export class ArticleVersionConflictError extends Error {
  constructor(articleId: string, expectedVersion: number, currentVersion: number) {
    super(
      `Article ${articleId} is at version ${currentVersion}; expected version ${expectedVersion}. Reload the article before updating.`
    );
    this.name = "ArticleVersionConflictError";
  }
}

export function createArticleService(options: ArticleServiceOptions): ArticleService {
  const createId = options.createId ?? (() => `article_${randomUUID()}`);
  const now = options.now ?? (() => new Date());

  return {
    async createArticle(rawText: string): Promise<ArticleDoc> {
      const articleId = createId();
      const timestamp = now().toISOString();
      const article = buildArticleDoc({
        articleId,
        createdAt: timestamp,
        rawText,
        updatedAt: timestamp,
        version: 1
      });

      options.db.exec("BEGIN;");
      try {
        insertArticle(options.db, article);
        insertArticleVersion(options.db, article);
        insertArticleBlocks(options.db, article);
        options.db.exec("COMMIT;");
      } catch (error) {
        options.db.exec("ROLLBACK;");
        throw error;
      }

      return article;
    },

    async updateArticle(articleId: string, rawText: string, expectedVersion: number): Promise<ArticleDoc> {
      const row = getArticleRow(options.db, articleId);
      if (!row) {
        throw new ArticleNotFoundError(articleId);
      }

      if (row.current_version !== expectedVersion) {
        throw new ArticleVersionConflictError(articleId, expectedVersion, row.current_version);
      }

      const version = row.current_version + 1;
      const existingArticle = getPersistedArticleVersion(options.db, articleId, row.current_version);
      const timestamp = now().toISOString();
      const article = buildArticleDoc({
        articleId,
        createdAt: existingArticle.meta.createdAt,
        rawText,
        updatedAt: timestamp,
        version
      });

      options.db.exec("BEGIN;");
      try {
        options.db
          .prepare(
            "update articles set current_version = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP where id = ?"
          )
          .run(article.version, JSON.stringify(article), article.id);
        insertArticleVersion(options.db, article);
        insertArticleBlocks(options.db, article);
        invalidateGeneratedStateForChangedBlocks(options.db, {
          articleId: article.id,
          invalidatedAt: timestamp,
          invalidatedBlockIds: diffInvalidatedBlocks(existingArticle.blocks, article.blocks).invalidatedBlockIds,
          previousVersion: existingArticle.version
        });
        options.db.exec("COMMIT;");
      } catch (error) {
        options.db.exec("ROLLBACK;");
        throw error;
      }

      return article;
    },

    async getArticle(articleId: string): Promise<ArticleDoc> {
      const row = getArticleRow(options.db, articleId);
      if (!row) {
        throw new ArticleNotFoundError(articleId);
      }

      return getPersistedArticleVersion(options.db, articleId, row.current_version);
    }
  };
}

interface BuildArticleDocOptions {
  articleId: string;
  createdAt: string;
  rawText: string;
  updatedAt: string;
  version: number;
}

function buildArticleDoc(options: BuildArticleDocOptions): ArticleDoc {
  return {
    id: options.articleId,
    version: options.version,
    blocks: parseBlocks(options.rawText, { version: options.version }),
    meta: {
      createdAt: options.createdAt,
      updatedAt: options.updatedAt,
      wordCount: countWords(options.rawText)
    }
  };
}

function insertArticle(db: BanderdashDatabase, article: ArticleDoc): void {
  db.prepare("insert into articles (id, current_version, payload_json) values (?, ?, ?)").run(
    article.id,
    article.version,
    JSON.stringify(article)
  );
}

function insertArticleVersion(db: BanderdashDatabase, article: ArticleDoc): void {
  db.prepare("insert into article_versions (id, article_id, version, payload_json) values (?, ?, ?, ?)").run(
    `${article.id}_v${article.version}`,
    article.id,
    article.version,
    JSON.stringify(article)
  );
}

function insertArticleBlocks(db: BanderdashDatabase, article: ArticleDoc): void {
  const statement = db.prepare(
    `insert into article_blocks
      (id, article_id, document_version, block_index, block_type, text, payload_json)
      values (?, ?, ?, ?, ?, ?, ?)`
  );

  article.blocks.forEach((block, index) => {
    statement.run(
      `${article.id}_v${article.version}_${block.id}`,
      article.id,
      article.version,
      index,
      block.type,
      block.text,
      JSON.stringify(block)
    );
  });
}

interface InvalidateGeneratedStateOptions {
  articleId: string;
  invalidatedAt: string;
  invalidatedBlockIds: string[];
  previousVersion: number;
}

function invalidateGeneratedStateForChangedBlocks(
  db: BanderdashDatabase,
  options: InvalidateGeneratedStateOptions
): void {
  if (options.invalidatedBlockIds.length === 0) {
    return;
  }

  const candidateIds = getCandidateIdsForBlocks(db, options.articleId, options.invalidatedBlockIds);
  if (candidateIds.length === 0) {
    return;
  }

  const generatedSpecIds = getGeneratedSpecIdsForCandidates(db, options.articleId, candidateIds);
  const reason = `Article blocks changed in version ${options.previousVersion + 1}.`;

  markRowsInvalidated(db, "candidates", "id", candidateIds, options.invalidatedAt, reason);
  markRowsInvalidated(db, "approvals", "candidate_id", candidateIds, options.invalidatedAt, reason);
  markRowsInvalidated(db, "generated_specs", "candidate_id", candidateIds, options.invalidatedAt, reason);
  markRowsInvalidated(db, "validation_results", "generated_spec_id", generatedSpecIds, options.invalidatedAt, reason);
  markRowsInvalidated(db, "qa_results", "generated_spec_id", generatedSpecIds, options.invalidatedAt, reason);
  invalidateExportsForCandidates(db, options.articleId, candidateIds, options.invalidatedAt, reason);
}

function getCandidateIdsForBlocks(db: BanderdashDatabase, articleId: string, blockIds: string[]): string[] {
  const placeholders = createPlaceholders(blockIds);
  const rows = db
    .prepare(`select id from candidates where article_id = ? and block_id in (${placeholders}) and invalidated_at is null`)
    .all(articleId, ...blockIds) as Array<{ id: string }>;

  return rows.map((row) => row.id);
}

function getGeneratedSpecIdsForCandidates(db: BanderdashDatabase, articleId: string, candidateIds: string[]): string[] {
  if (candidateIds.length === 0) {
    return [];
  }

  const placeholders = createPlaceholders(candidateIds);
  const rows = db
    .prepare(`select id from generated_specs where article_id = ? and candidate_id in (${placeholders})`)
    .all(articleId, ...candidateIds) as Array<{ id: string }>;

  return rows.map((row) => row.id);
}

function markRowsInvalidated(
  db: BanderdashDatabase,
  tableName: string,
  idColumn: string,
  ids: string[],
  invalidatedAt: string,
  reason: string
): void {
  if (ids.length === 0) {
    return;
  }

  const placeholders = createPlaceholders(ids);
  db.prepare(
    `update ${tableName}
      set invalidated_at = ?, invalidated_reason = ?
      where ${idColumn} in (${placeholders}) and invalidated_at is null`
  ).run(invalidatedAt, reason, ...ids);
}

function invalidateExportsForCandidates(
  db: BanderdashDatabase,
  articleId: string,
  candidateIds: string[],
  invalidatedAt: string,
  reason: string
): void {
  if (candidateIds.length === 0) {
    return;
  }

  const candidateIdPatterns = candidateIds.map((candidateId) => `%${candidateId}%`);
  const conditions = candidateIdPatterns.map(() => "payload_json like ?").join(" or ");
  db.prepare(
    `update exports
      set invalidated_at = ?, invalidated_reason = ?
      where article_id = ? and invalidated_at is null and (${conditions})`
  ).run(invalidatedAt, reason, articleId, ...candidateIdPatterns);
}

function createPlaceholders(values: string[]): string {
  return values.map(() => "?").join(", ");
}

function getArticleRow(db: BanderdashDatabase, articleId: string): ArticleRow | undefined {
  return db.prepare("select id, current_version from articles where id = ?").get(articleId) as ArticleRow | undefined;
}

function getPersistedArticleVersion(db: BanderdashDatabase, articleId: string, version: number): ArticleDoc {
  const versionRow = db
    .prepare("select payload_json from article_versions where article_id = ? and version = ?")
    .get(articleId, version) as ArticleVersionRow | undefined;

  if (!versionRow) {
    throw new ArticleNotFoundError(articleId);
  }

  return parsePersistedArticle(versionRow.payload_json);
}

function parsePersistedArticle(payloadJson: string): ArticleDoc {
  const value = JSON.parse(payloadJson) as unknown;

  if (!isArticleDoc(value)) {
    throw new Error("Persisted article document is invalid.");
  }

  return value;
}

export type { ArticleDoc, Block };
