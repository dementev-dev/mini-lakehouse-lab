-- создаём таблицу в каталоге lakehouse, в MinIO
CREATE TABLE lakehouse.default.demo_tbl (
  id BIGINT,
  txt STRING
)
USING iceberg;

INSERT INTO lakehouse.default.demo_tbl VALUES (1, 'hello'), (2, 'world');

SELECT * FROM lakehouse.default.demo_tbl;
