-- Merge overview into embedded_text.
-- Previously embedded_text was "title || ' ' || overview"; it now holds
-- just the descriptive summary text (what overview was) and is also the
-- sole input to the embedding model.
--
-- For existing rows, copy overview into embedded_text so no data is lost.
-- Embeddings will need to be regenerated after this migration since the
-- input text has changed.

update experience_blocks
set embedded_text = overview;

alter table experience_blocks drop column overview;
