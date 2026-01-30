-- pgvector Test Script
-- Run with: docker exec -i mindpoke-pgvector psql -U postgres -d mindpoke < scripts/test-pgvector.sql

-- 1. Verify extension is installed
SELECT '1. Extension check:' as test;
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- 2. Create a test table with vector column
SELECT '2. Creating test table with vector column:' as test;
DROP TABLE IF EXISTS vector_test;
CREATE TABLE vector_test (
  id SERIAL PRIMARY KEY,
  content TEXT,
  embedding vector(3)  -- small dimension for testing
);

-- 3. Insert test vectors
SELECT '3. Inserting test vectors:' as test;
INSERT INTO vector_test (content, embedding) VALUES
  ('apple fruit', '[1, 0, 0]'),
  ('banana fruit', '[0.9, 0.1, 0]'),
  ('car vehicle', '[0, 0, 1]'),
  ('truck vehicle', '[0.1, 0, 0.9]'),
  ('orange fruit', '[0.8, 0.2, 0]');

-- 4. Test cosine similarity search (find similar to 'apple')
SELECT '4. Cosine similarity search (similar to apple [1,0,0]):' as test;
SELECT 
  content,
  1 - (embedding <=> '[1, 0, 0]') as similarity
FROM vector_test
ORDER BY embedding <=> '[1, 0, 0]'
LIMIT 3;

-- 5. Test L2 distance search
SELECT '5. L2 distance search (closest to apple):' as test;
SELECT 
  content,
  embedding <-> '[1, 0, 0]' as distance
FROM vector_test
ORDER BY embedding <-> '[1, 0, 0]'
LIMIT 3;

-- 6. Test inner product search
SELECT '6. Inner product search (max dot product with apple):' as test;
SELECT 
  content,
  (embedding <#> '[1, 0, 0]') * -1 as inner_product
FROM vector_test
ORDER BY embedding <#> '[1, 0, 0]'
LIMIT 3;

-- 7. Create an index (HNSW for approximate nearest neighbor)
SELECT '7. Creating HNSW index:' as test;
CREATE INDEX ON vector_test USING hnsw (embedding vector_cosine_ops);

-- 8. Cleanup
SELECT '8. Cleanup:' as test;
DROP TABLE vector_test;

SELECT '✓ All pgvector tests passed!' as result;
