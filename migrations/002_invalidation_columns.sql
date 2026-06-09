ALTER TABLE candidates ADD COLUMN invalidated_at TEXT;
ALTER TABLE candidates ADD COLUMN invalidated_reason TEXT;

ALTER TABLE approvals ADD COLUMN invalidated_at TEXT;
ALTER TABLE approvals ADD COLUMN invalidated_reason TEXT;

ALTER TABLE generated_specs ADD COLUMN invalidated_at TEXT;
ALTER TABLE generated_specs ADD COLUMN invalidated_reason TEXT;

ALTER TABLE validation_results ADD COLUMN invalidated_at TEXT;
ALTER TABLE validation_results ADD COLUMN invalidated_reason TEXT;

ALTER TABLE qa_results ADD COLUMN invalidated_at TEXT;
ALTER TABLE qa_results ADD COLUMN invalidated_reason TEXT;

ALTER TABLE exports ADD COLUMN invalidated_at TEXT;
ALTER TABLE exports ADD COLUMN invalidated_reason TEXT;
