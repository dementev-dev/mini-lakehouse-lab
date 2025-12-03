-- Проверка чтения данных, созданных в Spark
USE lakehouse.default;

SHOW TABLES;
SELECT * FROM spark_trino_smoke;
