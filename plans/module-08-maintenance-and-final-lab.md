# Модуль 8. Базовое обслуживание таблиц и финальная практика

**Статус:** `Ready for validation`
**Последнее обновление:** `2026-09-15`

## Цель

Научить студента базовому обслуживанию Iceberg-таблиц (compaction и expire_snapshots) и закрепить все навыки курса в финальной сквозной практике. Студент создаёт демо-таблицу с искусственной проблемой мелких файлов, наблюдает деградацию, выполняет compaction и expire_snapshots, сопоставляет обслуживание с Greenplum AppendOnly, а затем самостоятельно проходит полный цикл `raw → bronze → silver → Trino → schema evolution → обслуживание` на отдельном мини-наборе данных. Результат: студент понимает, зачем Iceberg-таблицам нужно периодическое обслуживание, и может самостоятельно выполнить типовые DE-операции в Lakehouse-стенде.

## Результат для студента

После прохождения модуля студент:

- понимает проблему мелких файлов (small files problem) и её влияние на производительность чтения;
- умеет выполнить compaction (`rewrite_data_files`) и проверить результат через metadata-таблицы Iceberg;
- умеет выполнить `expire_snapshots` и понимает компромисс: очистка хранилища vs потеря time travel;
- знает порядок обслуживания: сначала compaction, потом expire_snapshots;
- может сопоставить обслуживание Iceberg с обслуживанием Greenplum AppendOnly-таблиц;
- может самостоятельно выполнить полный цикл `raw → bronze → silver → Trino → schema evolution → обслуживание`;
- прошёл финальный checkpoint курса и может объяснить ключевые архитектурные и прикладные принципы Lakehouse.

## Deliverables

- `notebooks/08_maintenance_and_final_lab.ipynb` — основной ноутбук Модуля 8;
- обновление `plans/README.md` — строка Модуля 8 в оглавлении.

Инфраструктурные изменения не требуются: Python-пакет `trino` уже добавлен в `jupyter/Dockerfile` в Модуле 6.

## Зависимости

### Предусловия

- Стенд поднят и работает (Модуль 1).
- Студент прошёл Модуль 5: таблица `lakehouse.silver.nyc_taxi_yellow` существует (не менее 24 колонок).
- Студент прошёл Модуль 6: Python `trino` клиент установлен, helper `trino_query()` используется для Trino-запросов.
- Raw-данные загружены в MinIO (Модуль 3): `s3a://lakehouse/raw/nyc_taxi/yellow_tripdata_*.parquet`.
- Модуль 7 рекомендуется, но не является жёстким предусловием: концепции snapshot-ов кратко повторяются в контексте обслуживания.

### Что используют последующие модули

Это финальный модуль курса. Downstream-зависимостей нет.

## Дизайн-решения

### Демо-таблица для обслуживания: искусственная проблема мелких файлов

Для демонстрации compaction и expire_snapshots создаётся таблица `lakehouse.default.taxi_maintenance_demo`. Silver-таблица не подходит: она создана одним CTAS и уже имеет оптимальную файловую структуру (мало крупных файлов). Демо-таблица намеренно фрагментируется:

- CTAS с 500 строками (snapshot 1, 1 data file);
- 8 мелких INSERT INTO по ~100 строк каждый (snapshots 2–9, 8 новых data files);
- итого: ~1300 строк, 9 data files, 9 snapshots.

Это создаёт наглядную проблему мелких файлов: 9 файлов вместо одного оптимального.

### Compaction: rewrite_data_files

`CALL lakehouse.system.rewrite_data_files(table => 'default.taxi_maintenance_demo')` — объединяет мелкие data files в меньшее количество крупных. Ключевые моменты для студента:

- создаёт новый snapshot (данные переписаны в новые файлы);
- старые data files остаются в MinIO до `expire_snapshots` — они ещё нужны для time travel к старым snapshot-ам;
- аналогия: дефрагментация диска или `ALTER TABLE ... REORGANIZE` в Greenplum.

### Порядок обслуживания: compaction → expire_snapshots

Осознанный порядок:

1. Сначала compaction — создаёт новые оптимальные файлы.
2. Потом expire_snapshots — удаляет старые snapshot-ы и файлы, на которые они ссылались (включая мелкие файлы до compaction).

Если сделать наоборот: expire_snapshots удалит snapshot-ы, но старые мелкие файлы останутся, потому что текущий snapshot ещё на них ссылается. Compaction после этого создаст новые файлы, но старые мелкие уже не будут привязаны ни к одному snapshot-у и станут orphan-файлами.

### expire_snapshots: компромисс между очисткой и time travel

`CALL lakehouse.system.expire_snapshots(table => '...', retain_last => 2)` — удаляет все snapshot-ы, кроме N последних. Ключевые моменты:

- удалённые snapshot-ы недоступны для time travel — это необратимо;
- по документации Iceberg, data files, на которые ссылались только удалённые snapshot-ы, должны удаляться из хранилища вместе со snapshot-ами. Однако поведение зависит от версии Iceberg, конфигурации каталога и файловой системы — **необходима проверка на стенде**. Если файлы не удаляются автоматически, в ноутбуке нужно явно отметить это и упомянуть `remove_orphan_files` как дополнительный шаг;
- `retain_last` — количество snapshot-ов, которые нужно сохранить (самые свежие);
- в production: expire_snapshots запускается периодически (Airflow, cron) с разумным retain_last (например, 10–30 дней истории).

Точный синтаксис (именованные параметры, `older_than` vs `retain_last`) зависит от версии Iceberg — нужна проверка на стенде при реализации.

### remove_orphan_files: упоминание без демонстрации

`remove_orphan_files` удаляет файлы в хранилище, которые не принадлежат ни одному snapshot-у (например, от упавших записей). В курсе упоминается для полноты картины, но не демонстрируется: при штатной работе orphan-файлы не возникают, и процедура нужна только для edge cases.

### Сравнение с silver: контрастная демонстрация

После демонстрации проблемы мелких файлов на демо-таблице показываем файловую статистику silver-таблицы. Ожидаемый результат: silver имеет мало крупных файлов (создан одним CTAS). Контрастный вывод: compaction нужен после множества мелких записей, а не после однократной загрузки.

### Greenplum AppendOnly: короткая параллель

Greenplum AppendOnly-таблицы имеют аналогичные проблемы:

- после UPDATE/DELETE в AppendOnly остаются «мёртвые» строки (dead tuples);
- `VACUUM` очищает мёртвые строки, `ALTER TABLE ... REORGANIZE` перестраивает сегменты;
- в Iceberg: `rewrite_data_files` аналог реорганизации, `expire_snapshots` аналог очистки устаревших версий.

Ключевое сходство: обе системы требуют периодического обслуживания. Ни Iceberg, ни AppendOnly не делают это автоматически в базовой конфигурации (в отличие от autovacuum для heap-таблиц в PostgreSQL).

### Финальная практика: отдельный namespace lakehouse.final

Финальная сквозная практика выполняется в отдельном namespace `lakehouse.final`, чтобы:

- не затрагивать основные таблицы bronze и silver;
- позволить студенту создать namespace самостоятельно (навык из Модуля 4);
- обеспечить чистый cleanup в конце.

Студент создаёт две таблицы (`trips_bronze`, `trips_silver`), проводит весь цикл, после чего удаляет namespace.

### Финальная практика: использование существующих raw-данных

Студент читает raw-данные из MinIO (`s3a://lakehouse/raw/nyc_taxi/yellow_tripdata_*.parquet`), уже загруженные в Модуле 3. Повторная загрузка в MinIO не требуется. Для контроля объёма — LIMIT 5000 строк на этапе чтения raw.

### Независимость от Модуля 7

Модуль 8 работает независимо от того, прошёл ли студент Модуль 7:

- если Модуль 7 пройден: silver может содержать колонку `loaded_at` — Модуль 8 не зависит от её наличия;
- если студент перезапустил Модуль 5 после Модуля 7: silver будет без `loaded_at` — Модуль 8 продолжает работать;
- концепции snapshot-ов кратко повторяются при объяснении expire_snapshots.

### Cleanup

- Демо-таблица `taxi_maintenance_demo` удаляется после демонстрации.
- Финальная практика: таблицы `lakehouse.final.trips_bronze` и `lakehouse.final.trips_silver` удаляются, namespace `lakehouse.final` удаляется.
- Silver (`lakehouse.silver.nyc_taxi_yellow`) и bronze (`lakehouse.bronze.nyc_taxi_yellow`) сохраняются — студент может продолжить эксперименты.
- Spark-сессия останавливается.

## План работ

1. Создать `notebooks/08_maintenance_and_final_lab.ipynb` по ячеечной структуре ниже.
2. Обновить `plans/README.md` — добавить строку Модуля 8 в таблицу оглавления.
3. Валидация: выполнить ноутбук сверху вниз на поднятом стенде после Модуля 6 (silver-таблица и Trino-доступ на месте, raw-данные в MinIO).

## Структура ноутбука

### Секция 0: Введение

- **[md]** Заголовок, цели модуля, prerequisites (Модуль 6 пройден, Модуль 7 рекомендуется). Две части модуля:

  1. Базовое обслуживание: compaction и expire_snapshots.
  2. Финальная практика: сквозной end-to-end сценарий.

- **[md]** Зачем нужно обслуживание. Iceberg-таблица — не «чёрный ящик». После множества записей накапливаются мелкие файлы и старые snapshot-ы. Без обслуживания: чтение замедляется (много мелких файлов), хранилище растёт (старые данные не удаляются). Это знакомо из мира Greenplum: AppendOnly-таблицы тоже требуют VACUUM и REORGANIZE.
- **[md]** Таблица-сравнение (предварительный обзор):

| | Greenplum AppendOnly | Iceberg |
|---|---|---|
| Проблема | Мёртвые строки после UPDATE/DELETE | Мелкие файлы после множества INSERT |
| Компактификация | `ALTER TABLE ... REORGANIZE` | `rewrite_data_files` |
| Очистка устаревших версий | Нет встроенной истории версий | `expire_snapshots` |
| Очистка мёртвых строк/файлов | `VACUUM` | `expire_snapshots` (удаляет старые файлы) |
| Автоматизация в базовой конфигурации | Ручной запуск | Ручной запуск |
| В production | Расписание через cron/Airflow | Расписание через cron/Airflow |

### Секция 1: Spark-сессия, Trino-клиент и проверка таблиц

- **[code]** SparkSession (паттерн Модулей 2–7). Константы: `SILVER_TABLE = "lakehouse.silver.nyc_taxi_yellow"`, `DEMO_TABLE = "lakehouse.default.taxi_maintenance_demo"`, `RAW_PATH = "s3a://lakehouse/raw/nyc_taxi/yellow_tripdata_*.parquet"`.
- **[code]** Assert: silver существует и непуста. Отсылка к Модулю 5.
- **[code]** Assert: raw-данные доступны в MinIO. Проверка через `spark.read.parquet(RAW_PATH).limit(1)` — при ошибке понятное сообщение с отсылкой к Модулю 3: «Raw-данные не найдены по пути {RAW_PATH}. Вернись в Модуль 3 и выполни загрузку данных в MinIO.» Raw нужен для финальной практики (Секция 9).
- **[code]** Helper `trino_query(sql)` (паттерн Модуля 6).
- **[md]** Silver на месте, raw-данные доступны, Trino готов. В первой части модуля создадим демо-таблицу и научимся её обслуживать. Во второй — финальная практика.

### Секция 2: Проблема мелких файлов

- **[md]** Каждый `INSERT INTO` в Iceberg создаёт новые data files. Если вставлять данные мелкими порциями (частые микробатчи, ручные INSERT-ы, инкрементальные загрузки), таблица накапливает множество мелких файлов. Это замедляет чтение: движку приходится открывать и читать каждый файл отдельно. Проблема знакома в мире Hadoop/Hive — и в Iceberg она решается через compaction.

- **[code]** Удаление одноразовой демо-таблицы через `DROP TABLE IF EXISTS ... PURGE`, затем создание с 500 строками (CTAS из silver). Это гарантирует один начальный snapshot и воспроизводимое число snapshot-ов при повторном запуске:

```python
spark.sql(f"DROP TABLE IF EXISTS {DEMO_TABLE} PURGE")
spark.sql(f"""
    CREATE TABLE {DEMO_TABLE}
    USING iceberg AS
    SELECT VendorID, tpep_pickup_datetime, tpep_dropoff_datetime,
           passenger_count, trip_distance, fare_amount, total_amount,
           pickup_borough, pickup_zone
    FROM {SILVER_TABLE}
    LIMIT 500
""")
print(f"Демо-таблица создана: {spark.table(DEMO_TABLE).count()} строк.")
```

- **[code]** 8 мелких INSERT INTO (цикл, по ~100 строк каждый):

```python
for i in range(8):
    spark.sql(f"""
        INSERT INTO {DEMO_TABLE}
        SELECT VendorID, tpep_pickup_datetime, tpep_dropoff_datetime,
               passenger_count, trip_distance, fare_amount, total_amount,
               pickup_borough, pickup_zone
        FROM {SILVER_TABLE}
        LIMIT 100
    """)
    print(f"INSERT {i+1}/8 выполнен.")

print(f"Итого строк: {spark.table(DEMO_TABLE).count()}")
```

- **[code]** Файловая статистика через metadata-таблицу:

```python
files_df = spark.sql(f"""
    SELECT file_path, file_format, record_count, file_size_in_bytes
    FROM {DEMO_TABLE}.files
""")
print(f"Количество data files: {files_df.count()}")
files_df.show(truncate=40)
```

- **[code]** Snapshot-история:

```python
spark.sql(f"SELECT snapshot_id, committed_at, operation, summary FROM {DEMO_TABLE}.snapshots").show(truncate=False)
```

- **[md]** Результат: 9 data files (1 от CTAS + 8 от INSERT), 9 snapshot-ов. Каждый INSERT создал отдельный маленький файл. В production-сценарии после недель инкрементальных загрузок таблица может накопить сотни и тысячи мелких файлов.

- **[md]** Для сравнения — посмотрим на silver-таблицу, которая была создана одним CTAS:

- **[code]** Файловая статистика silver:

```python
silver_files = spark.sql(f"SELECT file_path, record_count, file_size_in_bytes FROM {SILVER_TABLE}.files")
print(f"Silver: {silver_files.count()} data file(s)")
silver_files.show(truncate=40)
```

- **[md]** Silver имеет мало крупных файлов — проблемы мелких файлов нет. Compaction нужен не всегда, а после множества мелких записей. Далее — исправляем проблему на демо-таблице.

### Секция 3: Compaction — rewrite_data_files

- **[md]** `rewrite_data_files` объединяет мелкие data files в меньшее количество крупных. Аналогия: дефрагментация диска. Или `ALTER TABLE ... REORGANIZE` в Greenplum, который перестраивает сегменты AppendOnly-таблицы.

- **[code]** Файловая статистика ДО compaction (сохраняем для сравнения):

```python
files_before = spark.sql(f"SELECT count(*) AS file_count, sum(file_size_in_bytes) AS total_bytes FROM {DEMO_TABLE}.files").first()
print(f"До compaction: {files_before['file_count']} файлов, {files_before['total_bytes']} байт")
```

- **[code]** Compaction:

```python
spark.sql(f"CALL lakehouse.system.rewrite_data_files(table => 'default.taxi_maintenance_demo')")
print("Compaction выполнен.")
```

- **[code]** Файловая статистика ПОСЛЕ compaction:

```python
files_after = spark.sql(f"SELECT count(*) AS file_count, sum(file_size_in_bytes) AS total_bytes FROM {DEMO_TABLE}.files").first()
print(f"После compaction: {files_after['file_count']} файлов, {files_after['total_bytes']} байт")
print(f"Было {files_before['file_count']} файлов → стало {files_after['file_count']}")
```

- **[code]** Проверка данных: count не изменился.

```python
print(f"Строк в таблице: {spark.table(DEMO_TABLE).count()}")
```

- **[md]** Данные не изменились — только реорганизованы. Compaction создал новый snapshot с новыми, более крупными файлами. Но старые мелкие файлы всё ещё лежат в MinIO: они нужны для time travel к старым snapshot-ам. Чтобы освободить место — нужен `expire_snapshots`.

- **[code]** Snapshot-история: появился новый snapshot от compaction.

```python
spark.sql(f"SELECT snapshot_id, committed_at, operation FROM {DEMO_TABLE}.snapshots").show(truncate=False)
```

### Секция 4: expire_snapshots — очистка истории

- **[md]** После compaction в таблице 10 snapshot-ов: 9 от INSERT-ов + 1 от compaction. Старые snapshot-ы ссылаются на мелкие файлы, которые уже не нужны для текущего чтения. `expire_snapshots` удаляет старые snapshot-ы из метаданных. Data files, на которые ссылались только удалённые snapshot-ы, по спецификации Iceberg тоже должны удаляться — но это зависит от конфигурации стенда (проверим на практике).

- **[md]** Важный компромисс: после expire_snapshots time travel к удалённым snapshot-ам невозможен. Это необратимо. В production нужно решить: сколько истории хранить? Обычно 10–30 дней. Для демо — оставим 2 последних snapshot-а.

- **[code]** Snapshot-история ДО expire (сохраняем count):

```python
snapshots_before = spark.sql(f"SELECT snapshot_id, committed_at, operation FROM {DEMO_TABLE}.snapshots")
print(f"Snapshot-ов до expire: {snapshots_before.count()}")
snapshots_before.show(truncate=False)

# Сохраняем ID первого snapshot для проверки time travel после expire
first_snapshot_id = snapshots_before.orderBy("committed_at").first()["snapshot_id"]
print(f"Самый старый snapshot: {first_snapshot_id}")
```

- **[code]** expire_snapshots:

```python
spark.sql(f"""
    CALL lakehouse.system.expire_snapshots(
        table => 'default.taxi_maintenance_demo',
        retain_last => 2
    )
""")
print("expire_snapshots выполнен.")
```

- **[code]** Snapshot-история ПОСЛЕ expire:

```python
snapshots_after = spark.sql(f"SELECT snapshot_id, committed_at, operation FROM {DEMO_TABLE}.snapshots")
print(f"Snapshot-ов после expire: {snapshots_after.count()}")
snapshots_after.show(truncate=False)
```

- **[code]** Попытка time travel к удалённому snapshot (ожидаем ошибку):

```python
try:
    spark.sql(f"""
        SELECT count(*) FROM {DEMO_TABLE}
        VERSION AS OF {first_snapshot_id}
    """).show()
    print("Time travel сработал (snapshot не был удалён).")
except Exception as e:
    print(f"Ожидаемая ошибка: {e}")
    print("Snapshot удалён — time travel невозможен.")
```

- **[md]** Snapshot удалён, time travel невозможен. Это главное следствие expire_snapshots — необратимая потеря возможности отката к старым состояниям. В Модуле 7 мы использовали snapshot-ы для восстановления после ошибок — `expire_snapshots` лишает этой возможности для удалённых snapshot-ов. Поэтому expire нужно запускать обдуманно: не слишком агрессивно (потеря страховки), не слишком редко (рост метаданных и хранилища).

- **[md]** Примечание: физическое удаление data files из MinIO после expire зависит от конфигурации стенда. Если файлы остались — для их очистки существует отдельная процедура `remove_orphan_files`, которая удаляет файлы, не принадлежащие ни одному snapshot-у. В штатном режиме orphan-файлы не возникают (кроме как после expire или упавших записей). В этом курсе `remove_orphan_files` не демонстрируется.

### Секция 5: Порядок обслуживания и типичные ошибки

- **[md]** Правильный порядок обслуживания Iceberg-таблицы:

| Шаг | Операция | Что делает | Что будет, если пропустить |
|---|---|---|---|
| 1 | `rewrite_data_files` | Объединяет мелкие файлы в крупные | Чтение остаётся медленным |
| 2 | `expire_snapshots` | Удаляет старые snapshot-ы (и их файлы, если конфигурация позволяет) | Метаданные и хранилище растут без ограничений |

Если сделать наоборот (сначала expire, потом compaction): expire удалит snapshot-ы, но мелкие файлы останутся (текущий snapshot всё ещё на них ссылается). Compaction создаст новые файлы, но старые мелкие станут orphan-файлами — нужен будет дополнительный `remove_orphan_files`.

- **[md]** Типичные ошибки обслуживания:

  **Ошибка 1: Никогда не запускать compaction.** Таблица после месяцев инкрементальных загрузок имеет тысячи мелких файлов. Чтение занимает минуты вместо секунд.

  **Ошибка 2: expire_snapshots с `retain_last => 1` сразу после ошибки.** Студент вносит ошибку в данные (Модуль 7), затем запускает expire_snapshots, оставляя только последний (ошибочный) snapshot. Rollback к предыдущему состоянию невозможен. Правило: перед expire проверь, что текущее состояние таблицы корректно.

  **Ошибка 3: Запускать обслуживание на каждый INSERT.** Compaction и expire_snapshots — тяжёлые операции. Запускать их после каждой записи — расточительно. В production: по расписанию (раз в день/неделю), а не на каждый батч.

### Секция 6: Параллель с Greenplum AppendOnly

- **[md]** Развернутое сравнение для студентов с опытом Greenplum:

| Аспект | Greenplum AppendOnly | Iceberg |
|---|---|---|
| Как накапливается «мусор» | UPDATE/DELETE оставляют мёртвые строки в сегментах | Множество INSERT создают мелкие data files |
| Влияние на чтение | Сканирование мёртвых строк замедляет запросы | Открытие множества мелких файлов замедляет запросы |
| Компактификация | `ALTER TABLE ... REORGANIZE` (перестройка сегментов) | `rewrite_data_files` (объединение файлов) |
| Очистка | `VACUUM` (удаление мёртвых строк) | `expire_snapshots` (удаление старых snapshot-ов; файлы — при поддержке конфигурацией) |
| Автоматизация | `autovacuum` для heap-таблиц, ручной VACUUM для AO | Ручной запуск, автоматизация через Airflow/cron |
| Просмотр состояния | `pg_stat_all_tables`, `gp_toolkit.gp_bloat_diag` | `table.files`, `table.snapshots` (metadata-таблицы Iceberg) |
| Time travel после очистки | Невозможен (нет встроенной истории) | Невозможен для удалённых snapshot-ов, возможен для оставшихся |

- **[md]** Ключевое сходство: ни одна система не обслуживает себя полностью автоматически в базовой конфигурации. И в Greenplum, и в Iceberg — это задача инженера или оркестратора. Ключевое отличие: Iceberg даёт встроенную историю (snapshot-ы) и контролируемую очистку (`expire_snapshots` с `retain_last`), чего нет в Greenplum.

### Секция 7: Самостоятельное задание — обслуживание

- **[md]** Две задачи для закрепления навыков обслуживания.

  **Задача 1 (анализ silver).** Посмотри файловую статистику silver-таблицы (`lakehouse.silver.nyc_taxi_yellow`): количество data files, средний размер файла, количество snapshot-ов. Сравни с демо-таблицей до compaction. Нужна ли silver compaction? Ответь в markdown-ячейке и объясни — при каких условиях silver потребовала бы compaction?

  **Задача 2 (практика).** Создай таблицу `lakehouse.default.taxi_compaction_practice` через CTAS (500 строк из silver). Выполни 5 INSERT INTO по 200 строк. Посмотри файловую статистику, выполни compaction и expire_snapshots (retain_last => 1). Проверь результат. Удали таблицу.

- **[code]** Пустая ячейка: `# Ваш код: файловая статистика silver (файлы, размеры, snapshot-ы)`
- **[md]** Пустая markdown-ячейка: `Ваш ответ на Задачу 1: нужна ли compaction для silver? При каких условиях потребовалась бы? ...`
- **[code]** Пустая ячейка: `# Ваш код: создание taxi_compaction_practice + 5 INSERT`
- **[code]** Пустая ячейка: `# Ваш код: файловая статистика до compaction`
- **[code]** Пустая ячейка: `# Ваш код: compaction + expire_snapshots`
- **[code]** Пустая ячейка: `# Ваш код: файловая статистика после + DROP TABLE`

### Секция 8: Удаление демо-таблицы

- **[md]** Демо-таблица для обслуживания больше не нужна.
- **[code]** `spark.sql(f"DROP TABLE IF EXISTS {DEMO_TABLE} PURGE")`. Вывод подтверждения.

### Секция 9: Финальная практика — сквозной end-to-end сценарий

- **[md]** Финальная практика курса. Студент самостоятельно проходит полный цикл Lakehouse-пайплайна: от raw-данных до обслуживания таблицы. Все навыки из Модулей 1–8 в одном сценарии.

  Работа выполняется в отдельном namespace `lakehouse.final`, чтобы не затрагивать основные таблицы курса. После завершения — cleanup.

  Подсказки: путь к raw-данным — `s3a://lakehouse/raw/nyc_taxi/yellow_tripdata_*.parquet` (Модуль 3). Для контроля объёма используй `LIMIT 5000`.

- **[md]** **Сценарий: 8 шагов.**

  **Шаг 1 (namespace).** Создай namespace `lakehouse.final`.

  **Шаг 2 (bronze).** Прочитай raw parquet из MinIO (`s3a://lakehouse/raw/nyc_taxi/yellow_tripdata_*.parquet`, LIMIT 5000 строк) и создай таблицу `lakehouse.final.trips_bronze` через CTAS. Это bronze: данные «как есть», без трансформаций.

  **Шаг 3 (silver).** Создай `lakehouse.final.trips_silver` из bronze с тремя трансформациями:
  - Фильтр: `fare_amount >= 0` (убрать аномалии)
  - Нормализация: `passenger_count` → INT с обработкой NULL (`coalesce` + `cast`)
  - Обогащение: вычисляемая колонка `trip_duration_minutes`

  **Шаг 4 (Trino).** Прочитай `lakehouse.final.trips_silver` из Trino. Сравни count с результатом из Spark.

  **Шаг 5 (schema evolution).** Добавь колонку `processed_at TIMESTAMP` к `trips_silver` через `ALTER TABLE ADD COLUMNS`. Проверь из Trino, что колонка видна.

  **Шаг 6 (snapshot-ы).** Выполни 3 INSERT INTO `trips_silver` по ~300 строк из `trips_bronze`. Каждый INSERT должен включать те же трансформации, что и в шаге 3, плюс `current_timestamp() AS processed_at` для новой колонки из шага 5. Подсказка: если не указать `processed_at`, Spark выдаст ошибку несовпадения числа колонок; альтернативный вариант — использовать явный список target-колонок в `INSERT INTO trips_silver (col1, col2, ...)`. Создай snapshot-историю. Посмотри файловую статистику.

  **Шаг 7 (обслуживание).** Выполни compaction (`rewrite_data_files`), затем `expire_snapshots` (retain_last => 1). Проверь: файлов стало меньше, snapshot-ов осталось 1.

  **Шаг 8 (cleanup).** DROP TABLE `trips_silver`, DROP TABLE `trips_bronze`, DROP NAMESPACE `lakehouse.final`.

- **[code]** Пустая ячейка: `# Шаг 1: CREATE NAMESPACE`
- **[code]** Пустая ячейка: `# Шаг 2: прочитай raw и создай trips_bronze`
- **[code]** Пустая ячейка: `# Шаг 2: проверка trips_bronze (count, printSchema)`
- **[code]** Пустая ячейка: `# Шаг 3: создай trips_silver с трансформациями`
- **[code]** Пустая ячейка: `# Шаг 3: проверка trips_silver (count, проверка фильтра)`
- **[code]** Пустая ячейка: `# Шаг 4: чтение trips_silver из Trino`
- **[code]** Пустая ячейка: `# Шаг 5: ALTER TABLE ADD COLUMNS`
- **[code]** Пустая ячейка: `# Шаг 5: проверка из Trino (DESCRIBE)`
- **[code]** Пустая ячейка: `# Шаг 6: 3 INSERT INTO trips_silver`
- **[code]** Пустая ячейка: `# Шаг 6: файловая статистика и snapshot-ы`
- **[code]** Пустая ячейка: `# Шаг 7: compaction + expire_snapshots`
- **[code]** Пустая ячейка: `# Шаг 7: проверка результата`
- **[code]** Пустая ячейка: `# Шаг 8: cleanup (DROP TABLE, DROP NAMESPACE)`

### Секция 10: Финальный checkpoint

- **[md]** **Часть A — Обслуживание таблиц (Модуль 8):**
  1. Что такое проблема мелких файлов и когда она возникает?
  2. Что делает `rewrite_data_files`? Удаляет ли он старые файлы?
  3. Что делает `expire_snapshots`? Какой компромисс он создаёт?
  4. В каком порядке нужно выполнять compaction и expire_snapshots? Почему?
  5. Как обслуживание Iceberg-таблиц соотносится с VACUUM/REORGANIZE в Greenplum?

- **[md]** **Часть B — Весь курс (итоговые вопросы):**
  1. Назови три роли в архитектуре Lakehouse и какие компоненты стенда их выполняют.
  2. Почему Spark может записать данные, а Trino прочитать ту же таблицу без копирования?
  3. Чем raw отличается от bronze? Чем bronze отличается от silver?
  4. Что такое snapshot в Iceberg? Чем он отличается от бэкапа в PostgreSQL?
  5. Назови три безопасные и три опасные операции с Iceberg-таблицей.
  6. Зачем нужны compaction и expire_snapshots в production-сценарии?

### Секция 11: Завершение

- **[md]** Итог модуля:
  - Compaction (`rewrite_data_files`) — решает проблему мелких файлов, не меняя данные.
  - `expire_snapshots` — очищает старые snapshot-ы и файлы, но лишает возможности time travel.
  - Порядок: compaction → expire_snapshots.
  - Обслуживание Iceberg похоже на обслуживание Greenplum AppendOnly: обе системы требуют периодической заботы.

- **[md]** Итог курса. Что студент теперь умеет:
  1. Поднимать и диагностировать локальный Lakehouse-стенд (Модуль 1).
  2. Объяснять роли storage, catalog, compute (Модуль 2).
  3. Загружать raw-данные и проверять схему (Модуль 3).
  4. Создавать и заполнять Iceberg-таблицы (Модуль 4).
  5. Строить воспроизводимый поток raw → bronze → silver (Модуль 5).
  6. Читать одну таблицу из Spark и Trino (Модуль 6).
  7. Безопасно изменять таблицы: schema evolution, time travel, rollback (Модуль 7).
  8. Обслуживать таблицы: compaction, expire_snapshots (Модуль 8).

  Это базовый набор навыков для безопасной работы в Lakehouse-стенде. Дальше — production: партиционирование, MERGE, streaming, Airflow, governance. Но фундамент заложен.

- **[code]** `spark.stop()`.

### Дизайн-решения по ноутбуку

- **Исполняемый формат:** Spark SQL для compaction и expire_snapshots (stored procedures). Trino-запросы через Python `trino` клиент для downstream-верификации в финальной практике.
- **DBeaver-подсказки:** markdown-заметки рядом с Trino-ячейками (паттерн Модуля 6).
- **Helper-код:** `trino_query(sql)` — переиспользование из Модуля 6. Файловая статистика через metadata-таблицы Iceberg (`.files`, `.snapshots`).
- **Cleanup:** `DROP TABLE ... PURGE` для одноразовой демо-таблицы `taxi_maintenance_demo`. Финальная практика: DROP таблиц в namespace `final`, DROP namespace. Silver и bronze сохраняются.
- **Порядок:** проблема мелких файлов → compaction → expire_snapshots → Greenplum-параллель → ошибки → самостоятельное задание (обслуживание) → финальная практика (end-to-end) → checkpoint (модуль + курс) → итог курса.

## Checkpoint

Студент должен уметь:

- объяснить проблему мелких файлов и показать файловую статистику через metadata-таблицы;
- выполнить compaction и проверить, что файлов стало меньше, а данные не изменились;
- выполнить expire_snapshots и объяснить, почему time travel к удалённым snapshot-ам невозможен;
- назвать правильный порядок обслуживания и объяснить, почему он важен;
- сопоставить обслуживание Iceberg с обслуживанием Greenplum AppendOnly;
- самостоятельно выполнить полный цикл: raw → bronze → silver → Trino → schema evolution → обслуживание;
- ответить на итоговые вопросы курса по архитектуре, слоям, snapshot-ам и безопасным операциям.

## Acceptance Criteria

- `notebooks/08_maintenance_and_final_lab.ipynb` выполняется сверху вниз после прохождения Модуля 6 без внешних зависимостей (DBeaver не обязателен, Модуль 7 рекомендуется, но не обязателен).
- Ноутбук содержит: демонстрацию проблемы мелких файлов, compaction (`rewrite_data_files`), expire_snapshots, финальную сквозную практику.
- Методика курса: объяснение → демонстрация → самостоятельное повторение → checkpoint.
- Паттерны Модулей 1–7: SparkSession с адресом кластера из `spark-defaults.conf`, `setLogLevel("ERROR")`, `trino_query()`.
- Демо-таблица `taxi_maintenance_demo` создаётся и удаляется внутри ноутбука.
- Финальная практика в отдельном namespace `lakehouse.final` с полным cleanup в конце.
- При отсутствии silver — assert с отсылкой к Модулю 5. При отсутствии raw-данных в MinIO — assert с отсылкой к Модулю 3.
- Текст на русском с параллелями к PostgreSQL/Greenplum.
- Финальный checkpoint покрывает как модуль, так и весь курс.
- Silver и bronze сохраняются после выполнения ноутбука.
- `plans/README.md` содержит строку Модуля 8.

## Риски

- **Синтаксис `rewrite_data_files`.** Точный синтаксис stored procedure зависит от версии Iceberg и Spark. Вариант: `CALL lakehouse.system.rewrite_data_files(table => 'default.taxi_maintenance_demo')`. Возможны различия в именованных vs позиционных параметрах. Нужна проверка на стенде.
- **Синтаксис `expire_snapshots`.** Возможные параметры: `older_than` (TIMESTAMP), `retain_last` (INT). По умолчанию `older_than` = 5 дней назад, что не подходит для демо (snapshot-ы созданы минуты назад). Нужно явно передать `retain_last => 2` и, возможно, `older_than => current_timestamp()`. Проверить на стенде, работает ли `retain_last` без `older_than`.
- **expire_snapshots не удаляет файлы.** В некоторых конфигурациях `expire_snapshots` может не удалять data files автоматически. В этом случае нужно добавить `remove_orphan_files` или явно упомянуть, что файлы удаляются отдельно. Проверить на стенде.
- **Время выполнения цикла INSERT.** 8 INSERT-ов по ~100 строк из silver: каждый INSERT — отдельный Spark job. На стенде это может занять 2–5 минут. Предупреждение в markdown.
- **Время выполнения compaction.** `rewrite_data_files` перечитывает и перезаписывает данные. На демо-таблице (~1300 строк) — секунды. На silver (миллионы строк) — потенциально минуты. Предупреждение в markdown.
- **Финальная практика: путь к raw-данным.** Путь `s3a://lakehouse/raw/nyc_taxi/yellow_tripdata_*.parquet` соответствует маршруту загрузки из Модуля 3. Если студент по какой-то причине загрузил файлы по другому пути, он увидит ошибку при чтении. Добавить подсказку в markdown: «Если путь отличается от указанного, посмотри Модуль 3.»
- **Финальная практика: объём INSERT-ов.** При LIMIT 5000 для bronze и 3 INSERT по 300 строк в silver — объём данных минимален. Compaction может быть no-op (файлы и так небольшие). Решение: в инструкции явно указать, что цель — увидеть изменение количества файлов и snapshot-ов, а не добиться значимого улучшения производительности.
- **Повторный запуск.** Перед созданием одноразовой демо-таблицы выполняется `DROP TABLE ... PURGE`, иначе `CREATE OR REPLACE` сохранил бы прежние snapshot-ы и сломал ожидаемое число 9. В финальной практике студент должен учитывать уже существующие namespace и таблицы после прерванного запуска; cleanup в конце выполняется через `IF EXISTS`.
- **Независимость от Модуля 7.** Ноутбук не должен ссылаться на колонку `loaded_at` или результаты Модуля 7 как на обязательные предусловия. Snapshot-концепции кратко повторяются в контексте expire_snapshots.

## Out of Scope

- `remove_orphan_files` как отдельная демонстрация — упоминается, не демонстрируется.
- `rewrite_manifests` — оптимизация manifest-файлов, advanced-тема.
- Партиционирование и partition evolution — PRD: вне v1.
- Sort order и write distribution mode — advanced compaction options.
- Автоматизация обслуживания через Airflow/cron — упоминается как production-практика, не реализуется.
- Gold-слой в финальной практике — PRD: вне v1.
- Performance benchmarks (замеры времени чтения до/после compaction) — интересно, но выходит за рамки «базового обслуживания».
- `MERGE`, row-level `DELETE`, `UPDATE` — PRD: вне v1.
- Deep dive в Iceberg metadata JSON / manifest files — PRD: вне v1.
