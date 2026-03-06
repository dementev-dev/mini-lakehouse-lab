# Программа учебного курса: Введение в Lakehouse

Ориентировочная разбивка на 10 интерактивных уроков (Jupyter Notebooks).
Каждый урок рассчитан на 1-1.5 часа вдумчивой работы (теория + самостоятельная практика).

## Блок I. Основы Lakehouse (Storage + Format)

*   **01_intro_and_storage.ipynb**
    *   Что такое Lakehouse. Разделение хранения и вычислений. 
    *   Загрузка сырых файлов (CSV/JSON) в MinIO (S3).
*   **02_first_iceberg_table.ipynb**
    *   Создание первой Iceberg-таблицы через Spark. 
    *   Изучение структуры файлов (data, metadata, manifests) в MinIO.

## Блок II. Единая точка правды (Catalog + Compute)

*   **03_the_catalog.ipynb**
    *   Роль JDBC-каталога (PostgreSQL). 
    *   Как разные движки находят таблицы.
*   **04_spark_meets_trino.ipynb**
    *   Разделение ролей (Spark пишет, Trino читает). 
    *   Выполнение SQL-запросов к Iceberg-таблицам через Trino (интеграция вызовов Trino прямо в Jupyter).

## Блок III. Инженерия данных (Data Pipelines)

*   **05_bronze_layer.ipynb**
    *   Чтение сырых данных Spark'ом и инжест "как есть" (Raw to Bronze).
*   **06_silver_layer_and_schema_evolution.ipynb**
    *   Очистка данных. 
    *   *Практика:* самостоятельное применение Schema Evolution (добавление/изменение колонок).
*   **07_gold_layer_and_partitioning.ipynb**
    *   Агрегации бизнес-метрик. 
    *   *Практика:* самостоятельное партиционирование таблиц для ускорения запросов (Partition Pruning).

## Блок IV. Продвинутые фичи Lakehouse

*   **08_time_travel_and_snapshots.ipynb**
    *   Работа со снапшотами (Snapshots). 
    *   *Практика:* восстановление таблицы после ошибочных `DELETE`/`UPDATE`, чтение "исторических" данных.
*   **09_lakehouse_maintenance.ipynb**
    *   Проблема мелких файлов. 
    *   Компактизация (Compaction) и очистка старых версий (Vacuum).
*   **10_final_pipeline.ipynb**
    *   *Практика:* самостоятельный финальный end-to-end мини-пайплайн (Bronze -> Silver -> Gold), объединяющий все пройденные концепции.