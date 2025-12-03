-- Партиционированная Iceberg-таблица lakehouse.default.partition_demo

CREATE NAMESPACE IF NOT EXISTS lakehouse.default;

DROP TABLE IF EXISTS lakehouse.default.partition_demo;

CREATE TABLE lakehouse.default.partition_demo (
  user_id    BIGINT,
  event_date DATE,
  amount     DOUBLE
)
USING iceberg
PARTITIONED BY (event_date);

INSERT INTO lakehouse.default.partition_demo VALUES
  (1, '2024-01-01', 10.0),
  (2, '2024-01-01', 20.0),
  (3, '2024-02-01', 30.0),
  (4, '2024-02-01', 40.0);

