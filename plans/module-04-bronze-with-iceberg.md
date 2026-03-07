# Модуль 4. Первая рабочая Iceberg-таблица и слой bronze

**Статус:** `Draft`
**Последнее обновление:** `2026-03-07`

## Цель

Научить студента переходу от набора raw-файлов к управляемой Iceberg-таблице. Студент создаёт namespace `bronze`, записывает raw-данные NYC Taxi в Iceberg-таблицу и осматривает внутреннюю структуру таблицы (snapshots, data files, manifests). Студент понимает разницу между «каталогом с Parquet-файлами» и «управляемой таблицей» и связывает bronze-слой с привычным stg/ods-мышлением.

## Результат для студента

После прохождения модуля студент:

- умеет создать Iceberg namespace и таблицу через Spark SQL;
- умеет загрузить raw-данные из MinIO в bronze-таблицу через CTAS (`CREATE OR REPLACE TABLE ... AS SELECT`);
- понимает разницу между `spark.read.parquet("s3a://...")` (набор файлов) и `spark.table("lakehouse.bronze.nyc_taxi_yellow")` (управляемая таблица);
- умеет осмотреть структуру Iceberg-таблицы: snapshots, history, data files;
- умеет сопоставить физическую структуру в MinIO (metadata/, data/) с логической таблицей;
- понимает, зачем нужен bronze-слой и как он соотносится с stg/ods в классическом DWH;
- понимает, что таблица в Lakehouse — это не «один каталог с файлами», а согласованный набор data files + metadata + catalog entry.

## Deliverables

- `notebooks/04_bronze_with_iceberg.ipynb` — основной ноутбук Модуля 4;
- обновление индекса планов в `plans/README.md`.

Инфраструктурные изменения не требуются: `docker-compose.yml`, `START_HERE.md`, `docs/stack_reference.md` уже содержат всё необходимое после Модуля 3.

## Зависимости

### Предусловия

- Стенд поднят и работает (Модуль 1).
- Студент прошёл Модуль 3: raw-данные загружены в `s3a://lakehouse/raw/nyc_taxi/yellow_tripdata_*.parquet` и `taxi_zone_lookup.csv`.
- Каталог `lakehouse` настроен в `spark-defaults.conf` как JdbcCatalog с warehouse `s3a://lakehouse/warehouse`.

### Что используют последующие модули

- Модуль 5 читает `lakehouse.bronze.nyc_taxi_yellow` для построения silver.
- Модуль 6 читает bronze/silver через Trino.

## Дизайн-решения

### Namespace: `lakehouse.bronze` (не `module_04`)

Семантическое имя, потому что:
- Модуль 5 будет читать `lakehouse.bronze.*` для построения silver — семантическое имя делает связь явной.
- Подкрепляет мышление слоями `raw → bronze → silver` (PRD Risk #4: не смешивать роли слоёв).
- Модуль 2 использовал `module_02` для throwaway-демо с cleanup. Bronze — постоянный слой без cleanup, поэтому другая конвенция.

### Создание и наполнение таблицы: CTAS с явным списком колонок

Используем `CREATE OR REPLACE TABLE ... USING iceberg AS SELECT col1, col2, ... FROM raw_view` (CTAS). Это:
- объединяет создание и наполнение в один шаг — понятнее и ближе к `CREATE TABLE AS SELECT` в PostgreSQL;
- явный список колонок в SELECT исключает ошибки из-за несовпадения порядка или состава колонок (PRD Risk #3, #5);
- `CREATE OR REPLACE` обеспечивает идемпотентность: повторный запуск пересоздаёт таблицу, snapshot history остаётся чистой;
- trade-off: `CREATE OR REPLACE` уничтожает историю — в production это опасно, но для первичной загрузки учебного bronze допустимо. В Модуле 7 студент увидит, почему в рабочих сценариях нужен другой подход.

В Секции 2 DDL с явной схемой показывается как справочный пример (не выполняется) — чтобы студент увидел знакомую форму `CREATE TABLE (col type, ...)`.

### Инспекция Iceberg: три уровня глубины

Модуль 2 показал level 1 (catalog entry в PostgreSQL + файлы в MinIO). Модуль 4 идёт глубже:

- **Spark metadata tables:** `.snapshots`, `.history`, `.files` — встроенные metadata-таблицы Iceberg;
- **Физическая структура в MinIO:** boto3 листинг с разделением `[DATA]` / `[META]`, ASCII-дерево каталогов;
- **Таблица-сравнение** PostgreSQL/Greenplum vs Iceberg (pg_catalog ↔ JDBC catalog, heap files ↔ Parquet data files, WAL/MVCC ↔ snapshots).

### Cleanup: нет

Bronze нужен Модулю 5. Spark-сессия останавливается. Явное пояснение в финале ноутбука: «Мы намеренно не удаляем bronze-таблицы. В Модуле 5 мы будем строить silver на основе bronze.»

### Taxi zone lookup: демо-секция

Создание `lakehouse.bronze.taxi_zone_lookup` входит в демонстрационный код ноутбука (Секция 8), а не в самостоятельное задание. Причина: Модуль 5 использует lookup для JOIN в демо-коде — если lookup не создан, студент не может пройти Модуль 5, даже выполняя только готовые ячейки. Принцип: демо-ячейки последующих модулей не должны зависеть от домашних заданий предыдущих.

## План работ

1. Создать `notebooks/04_bronze_with_iceberg.ipynb` по ячеечной структуре, описанной ниже.
2. Обновить `plans/README.md` — добавить строку Модуля 4 в таблицу оглавления.
3. Валидация: убедиться, что ноутбук выполняется сверху вниз на поднятом стенде после прохождения Модуля 3 (raw-данные в MinIO).

## Структура ноутбука

### Секция 0: Введение
- **[md]** Заголовок: «Модуль 4. Первая рабочая Iceberg-таблица и слой bronze». Цели модуля. Prerequisite: Модуль 3 пройден, raw-данные в MinIO. Таблица-сравнение:

| | Классический DWH (Greenplum) | Lakehouse |
|---|---|---|
| Raw-данные | Загружены в stg-таблицу через COPY/gpfdist | Файлы в объектном хранилище (raw-зона) |
| Bronze/ODS | `CREATE TABLE AS SELECT` из stg | `CREATE TABLE ... USING iceberg AS SELECT` из raw (CTAS) |
| Метаданные | pg_catalog (внутри СУБД) | Внешний каталог (PostgreSQL JDBC) + файлы metadata в MinIO |
| История изменений | Нет (или WAL на уровне СУБД) | Snapshots и manifests (встроены в формат) |

### Секция 1: Spark-сессия и проверка raw
- **[code]** SparkSession (паттерн Модулей 2-3: без `.master()`, `setLogLevel("ERROR")`).
- **[code]** Быстрая проверка: `spark.read.parquet("s3a://lakehouse/raw/nyc_taxi/yellow_tripdata_*.parquet").count()` + `.printSchema()`. Assert на ненулевой count с отсылкой к Модулю 3.
- **[md]** Сейчас читаем как набор файлов — нет истории, каталогизации, контроля схемы. Дальше создадим управляемую таблицу.

### Секция 2: Создание namespace и знакомство с DDL
- **[md]** Что такое namespace в Iceberg (аналог schema/database в PostgreSQL). Почему `bronze`, а не `module_04`.
- **[code]** `CREATE NAMESPACE IF NOT EXISTS lakehouse.bronze`.
- **[md]** Как выглядит DDL Iceberg-таблицы: показываем полную схему Yellow Taxi как справочный пример (не выполняем). Это знакомая студенту форма — `CREATE TABLE ... (col type, ...)`, как в PostgreSQL. Объясняем ключевое отличие: `USING iceberg` — указание на формат таблицы.
- **[md]** Для создания и одновременного наполнения таблицы данными используем CTAS (CREATE TABLE AS SELECT) — это удобнее, чем отдельные DDL + INSERT. Перечисляем колонки: VendorID, tpep_pickup_datetime, tpep_dropoff_datetime, passenger_count, trip_distance, RatecodeID, store_and_fwd_flag, PULocationID, DOLocationID, payment_type, fare_amount, extra, mta_tax, tip_amount, tolls_amount, improvement_surcharge, total_amount, congestion_surcharge, Airport_fee.

### Секция 3: Загрузка raw → bronze (CTAS)
- **[md]** Аналогия с `CREATE TABLE ods AS SELECT ... FROM stg` в Greenplum. Почему явный список колонок: `SELECT *` привязывается к порядку, а не к именам — это хрупко и может дать некорректное сопоставление полей. Используем `CREATE OR REPLACE TABLE ... AS SELECT col1, col2, ... FROM raw_yellow` — CTAS одновременно создаёт таблицу и наполняет данными.
- **[md]** Идемпотентность: `CREATE OR REPLACE` при повторном запуске пересоздаёт таблицу с чистого листа — snapshot history остаётся чистой (один snapshot = одна загрузка). Trade-off: в production `CREATE OR REPLACE` — разрушительная операция (удаляет историю), но для первичной загрузки учебного bronze это осознанный выбор ради простоты. В Модуле 7 увидим, почему в рабочих сценариях нужен другой подход.
- **[code]** Чтение raw → `createOrReplaceTempView("raw_yellow")` → `CREATE OR REPLACE TABLE lakehouse.bronze.nyc_taxi_yellow USING iceberg AS SELECT VendorID, tpep_pickup_datetime, ... FROM raw_yellow` (CTAS с явным списком колонок).
- **[code]** Верификация: count bronze vs count raw — должны совпасть.

### Секция 4: Файлы vs управляемая таблица
- **[md]** Ключевой момент модуля: два способа доступа к одним и тем же данным.
- **[code]** Демо обоих способов: `spark.read.parquet("s3a://...")` vs `spark.table("lakehouse.bronze.nyc_taxi_yellow")`. Оба дают одинаковый count и columns, но таблица даёт каталог, историю, схему, доступ через Trino.
- **[md]** Таблица-сравнение свойств:

| Свойство | Raw файлы | Iceberg-таблица |
|---|---|---|
| Каталогизация | Нет | Да (PostgreSQL JDBC) |
| История изменений | Нет | Snapshots |
| Контроль схемы | Выводится из файлов | Зафиксирована в metadata |
| Чтение из Trino | Невозможно | Да |
| Атомарность записи | Нет | Да |

### Секция 5: Осмотр структуры Iceberg

#### 5a: Snapshots
- **[md]** Snapshot = «снимок» состояния таблицы. Аналогия с PostgreSQL: как если бы каждая транзакция оставляла именованный checkpoint.
- **[code]** `SELECT * FROM lakehouse.bronze.nyc_taxi_yellow.snapshots`.
- **[md]** Пояснение полей: `committed_at`, `snapshot_id`, `operation`, `summary`.

#### 5b: History
- **[code]** `SELECT * FROM lakehouse.bronze.nyc_taxi_yellow.history`.
- **[md]** Последовательность snapshots. Каждый — результат конкретной операции.

#### 5c: Data files
- **[code]** `SELECT file_path, file_format, record_count, file_size_in_bytes / 1024 / 1024 AS size_mb FROM lakehouse.bronze.nyc_taxi_yellow.files`.
- **[md]** Каждый data file — отдельный Parquet в MinIO. Iceberg знает, какие файлы принадлежат текущему snapshot.

#### 5d: Физическая структура в MinIO
- **[code]** Листинг через boto3 с разделением `[DATA]` / `[META]` (паттерн из Module 2). Итого по размерам data vs metadata.
- **[md]** ASCII-дерево (после CTAS — один snapshot, одна операция):
  ```
  warehouse/bronze/nyc_taxi_yellow/
  ├── metadata/
  │   ├── v1.metadata.json      ← CTAS создал таблицу и записал данные (текущий)
  │   ├── snap-*.avro           ← manifest list (один snapshot)
  │   └── *.avro                ← manifests (списки data files)
  └── data/
      ├── *.parquet             ← данные
      └── ...
  ```
  CTAS создаёт таблицу и наполняет данными за одну операцию, поэтому в metadata один metadata JSON и один snapshot.
  В Модуле 7 увидим, как snapshots помогают вернуться к предыдущему состоянию.

### Секция 6: raw → bronze и привычное мышление
- **[md]** Мини-лекция (3-4 абзаца):
  - В классическом DWH: stg → ods → dds. В Lakehouse: raw → bronze → silver (→ gold, за рамками курса).
  - Bronze — первый управляемый слой. Содержит данные «как есть» из raw, но уже как Iceberg-таблицу: с каталогом, историей, возможностью чтения через Trino.
  - Bronze ≠ raw. Raw — неизменяемый архив файлов. Bronze — управляемая таблица, которую можно пересоздать из raw.
  - В Модуле 5 — silver: очистка, трансформации, бизнес-логика.

### Секция 7: Вторая bronze-таблица: taxi_zone_lookup
- **[md]** В raw-зоне кроме Yellow Taxi лежит `taxi_zone_lookup.csv` — справочник зон. В Модуле 5 он понадобится для JOIN. Загружаем в bronze по тому же паттерну CTAS, но из CSV.
- **[code]** Чтение CSV через `spark.read.option("header", "true").option("inferSchema", "true").csv(...)`. Вывод count, schema, preview.
- **[code]** CTAS: `CREATE OR REPLACE TABLE lakehouse.bronze.taxi_zone_lookup USING iceberg AS SELECT CAST(LocationID AS INT) AS LocationID, Borough, Zone, service_zone FROM raw_zone_lookup`. Верификация: count, show.

### Секция 8: Самостоятельное задание
- **[md]** Инструкция: осмотреть внутреннюю структуру `taxi_zone_lookup` теми же инструментами, что в Секциях 5 и 6. (1) Вывести snapshots и files. (2) Сравнить количество data files с `nyc_taxi_yellow` и объяснить разницу.
- **[code]** 2 пустых ячейки `# Ваш код: ...`.

### Секция 9: Checkpoint
- **[md]** Вопросы для самопроверки:
  1. Чем отличается `spark.read.parquet("s3a://...")` от `spark.table("lakehouse.bronze.nyc_taxi_yellow")`?
  2. Что хранит snapshot и зачем он нужен?
  3. Где физически лежат данные bronze-таблицы и где метаданные?
  4. Почему bronze — это не то же самое, что raw?
  5. Что произойдёт, если удалить один data file из MinIO, но не изменить metadata?
  6. Можете ли вы показать таблицу в MinIO Console (через браузер)?

### Секция 10: Завершение
- **[md]** «Мы намеренно не удаляем bronze-таблицы (`nyc_taxi_yellow` и `taxi_zone_lookup`). Они понадобятся в Модуле 5, где мы будем строить silver-слой.»
- **[code]** `spark.stop()`.

### Дизайн-решения по ноутбуку

- **Helper-код:** весь код inline в ноутбуке. Студент должен видеть каждый шаг: CTAS, metadata-запросы, boto3.
- **Cleanup:** нет. Bronze нужен Модулю 5. Spark-сессия останавливается.

## Checkpoint

Студент должен уметь:

- создать Iceberg namespace и таблицу через Spark SQL;
- загрузить raw-данные в bronze-таблицу;
- объяснить разницу между чтением raw-файлов и чтением управляемой таблицы;
- показать snapshots, history и data files через metadata-таблицы Iceberg;
- показать физическую структуру таблицы в MinIO (через UI или код);
- объяснить, зачем нужен bronze-слой и чем он отличается от raw.

## Acceptance Criteria

- `notebooks/04_bronze_with_iceberg.ipynb` можно выполнить сверху вниз в поднятом Jupyter-окружении после прохождения Модуля 3 (raw-данные в MinIO).
- Ноутбук следует методике курса: `объяснение → демонстрация → самостоятельное повторение → checkpoint`.
- Ноутбук использует паттерны из Модулей 1-3: SparkSession без `.master()`, `setLogLevel("ERROR")`, `boto3` для MinIO.
- Ноутбук идемпотентен: повторное выполнение (`CREATE OR REPLACE`) не дублирует данные и не роняет ячейки.
- CTAS использует явный список колонок, а не `SELECT *`.
- Bronze-таблица `lakehouse.bronze.nyc_taxi_yellow` остаётся после выполнения ноутбука для использования в Модуле 5.
- При отсутствии raw-данных — понятный assert с отсылкой к Модулю 3.
- Текст ноутбука на русском языке с параллелями к PostgreSQL/Greenplum.
- `plans/README.md` содержит строку Модуля 4 в оглавлении.

## Риски

- **Время CTAS.** ~7-10 млн строк за 1-3 мин на стенде (2 workers × 2 GB). Extended (12 мес) — до 5-10 мин. Добавить markdown-предупреждение перед ячейкой загрузки.
- **Схема raw PARQUET.** Фиксируем колонки NYC Taxi 2024 в DDL. Если студент скачал другой год — DDL может не совпасть. Пояснение: придерживаться инструкции из `START_HERE.md`.
- **Column case sensitivity.** NYC Taxi PARQUET использует mixed case (`VendorID`, `PULocationID`). Iceberg хранит имена case-sensitive. DDL должен совпадать с именами в PARQUET. Проверить на стенде при реализации.
- **Мелкие файлы.** Spark может создать много мелких data files (по числу partitions). Нормально для Module 4 — тема compaction отложена до Модуля 8. Упомянуть, не решать.
- **Идемпотентность.** Используем `CREATE OR REPLACE TABLE ... AS SELECT` (CTAS) для повторных запусков — пересоздаёт таблицу целиком, snapshot history остаётся чистой. Это проще и надёжнее, чем `DELETE FROM` + `INSERT INTO` (который усложняет snapshot history и требует проверки поддержки `DELETE` на текущем стеке). Компромисс: `CREATE OR REPLACE` уничтожает предыдущие snapshots, но для учебного bronze это допустимо. В markdown явно объяснить этот trade-off.

## Out of Scope

- Трансформации и очистка данных — отложено до Модуля 5.
- Чтение bronze через Trino — отложено до Модуля 6.
- Time travel и schema evolution — отложено до Модуля 7.
- Compaction и vacuum — отложено до Модуля 8.
- Партиционирование bronze-таблицы (PRD: вне v1).
- Gold-слой и бизнес-витрины.
