-- Enable the pgvector extension for storing and querying embedding vectors.
-- Must run before any table that uses the vector type.
create extension if not exists vector;
