-- Проверка эволюции схемы в Trino для таблицы,
-- созданной в Spark (lakehouse.default.schema_evolution_demo).

USE lakehouse.default;

SHOW TABLES LIKE 'schema_evolution_demo';

DESCRIBE schema_evolution_demo;

SELECT *
FROM schema_evolution_demo
ORDER BY id;

