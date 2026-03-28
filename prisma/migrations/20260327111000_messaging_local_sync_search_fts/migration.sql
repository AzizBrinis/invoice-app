CREATE INDEX IF NOT EXISTS "MessagingLocalMessage_searchText_tsv_idx"
  ON "MessagingLocalMessage"
  USING GIN (to_tsvector('simple', COALESCE("searchText", '')));
