-- Эволюция схемы Iceberg-таблицы lakehouse.default.schema_evolution_demo

CREATE NAMESPACE IF NOT EXISTS lakehouse.default;

DROP TABLE IF EXISTS lakehouse.default.schema_evolution_demo;

CREATE TABLE lakehouse.default.schema_evolution_demo (
  id    BIGINT,
  value STRING
)
USING iceberg;

INSERT INTO lakehouse.default.schema_evolution_demo VALUES
  (1, 'old_row_1'),
  (2, 'old_row_2');

ALTER TABLE lakehouse.default.schema_evolution_demo
  ADD COLUMN metadata STRING;

INSERT INTO lakehouse.default.schema_evolution_demo VALUES
  (3, 'new_row_1', 'extra_info'),
  (4, 'new_row_2', 'extra_info');

