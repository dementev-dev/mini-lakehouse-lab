# Модуль 7. Безопасная работа с таблицами: schema evolution и time travel

**Статус:** `Ready for validation`
**Последнее обновление:** `2026-09-15`

## Цель

Научить студента безопасно изменять Iceberg-таблицы и использовать встроенные защитные механизмы формата. Студент добавляет колонку к silver-таблице (schema evolution), наблюдает эффект на downstream-чтение из Trino, изучает snapshot-историю, выполняет time travel к предыдущему состоянию и восстанавливает таблицу после намеренной ошибки. Результат: студент понимает, что Iceberg хранит полную историю изменений и предоставляет инструменты безопасной работы, которых нет в классических СУБД.

## Результат для студента

После прохождения модуля студент:

- умеет добавить колонку к Iceberg-таблице через `ALTER TABLE` и понимает, что существующие данные получают NULL;
- умеет проверить результат schema evolution из Spark и из Trino;
- понимает влияние schema evolution на downstream-чтение (новая колонка видна всем движкам автоматически через общий каталог);
- умеет посмотреть историю snapshot-ов таблицы и понимает, что каждая операция с данными создаёт snapshot;
- умеет прочитать предыдущее состояние таблицы через time travel (`VERSION AS OF`, `TIMESTAMP AS OF`);
- умеет восстановить таблицу после ошибки через `rollback_to_snapshot`;
- знает типичные ошибки новичка: слепой overwrite (`CREATE OR REPLACE`), изменение типов без проверки, отсутствие проверки snapshot-истории перед деструктивными операциями;
- может сопоставить snapshot-ы и time travel с отсутствием аналогичных механизмов в PostgreSQL/Greenplum (где для отката нужен бэкап/PITR).

## Deliverables

- `notebooks/07_safe_table_changes.ipynb` — основной ноутбук Модуля 7;
- обновление `plans/README.md` — строка Модуля 7 в оглавлении.

Инфраструктурные изменения не требуются: Python-пакет `trino` уже добавлен в `jupyter/Dockerfile` в Модуле 6.

## Зависимости

### Предусловия

- Стенд поднят и работает (Модуль 1).
- Студент прошёл Модуль 5: таблица `lakehouse.silver.nyc_taxi_yellow` существует (не менее 24 колонок).
- Студент прошёл Модуль 6: Python `trino` клиент установлен, helper `trino_query()` используется для Trino-запросов.

### Что используют последующие модули

- Модуль 8 использует silver-таблицу для финальной практики, compaction и vacuum. Колонка `loaded_at` — демонстрационный результат schema evolution; Модуль 8 НЕ зависит от её наличия и должен работать независимо от того, прошёл ли студент Модуль 7 или перезапустил Модуль 5 после него.
- Модуль 8 демонстрирует `expire_snapshots` — логическое продолжение snapshot-концепции из Модуля 7.

## Дизайн-решения

### Schema evolution на silver: реалистичная безопасная операция

`ADD COLUMN` — единственная операция schema evolution, которая применяется к production-like таблице (silver). Это осознанный выбор:

- `ADD COLUMN` — гарантированно безопасная операция: существующие данные не изменяются, новая колонка получает NULL;
- студент видит, что schema evolution можно делать на рабочих таблицах, а не только на throwaway-демо;
- downstream (Trino) автоматически видит новую колонку — подкрепление урока Модуля 6;
- добавленная колонка `loaded_at TIMESTAMP` — демонстрационная модификация. Модуль 8 НЕ зависит от её наличия: если студент перезапустит Модуль 5 после Модуля 7, `CREATE OR REPLACE` пересоздаст silver без `loaded_at`, и Модуль 8 продолжит работать. Это осознанное решение: schema evolution демонстрируется на реальной таблице, но не создаёт хрупкой зависимости между модулями.

`RENAME COLUMN` и другие потенциально опасные операции демонстрируются только на демо-таблице.

### Различие между schema evolution и data snapshot

Важный нюанс для ноутбука: `ALTER TABLE ADD COLUMNS` — metadata-only операция. Она создаёт новую версию metadata (новый `metadata.json`), но НЕ создаёт новый data snapshot. Data files не перезаписываются. Snapshot-ы фиксируют изменения данных (INSERT, overwrite, delete), а не изменения схемы. Это различие нужно проговорить в markdown, чтобы студент не путал schema change с data change.

### Демо-таблица для time travel и экспериментов

Для демонстрации time travel и восстановления после ошибки создаётся отдельная таблица `lakehouse.default.taxi_changes_demo` (небольшое подмножество silver — 1000 строк). Причины:

- time travel требует нескольких snapshot-ов, которые создаются через `INSERT INTO`;
- деструктивные эксперименты (INSERT плохих данных, RENAME) не затрагивают silver;
- демо-таблица удаляется в конце модуля.

### Механизм recovery: rollback_to_snapshot

Iceberg предоставляет stored procedure `CALL system.rollback_to_snapshot(table, snapshot_id)`. Это:

- переключает текущее состояние на существующий snapshot-предок и не создаёт новый snapshot;
- добавляет запись в `.history` о смене текущего состояния, а прежние snapshot-ы остаются доступными;
- старые data files не удаляются — они остаются до процедуры `expire_snapshots` / vacuum (Модуль 8);
- отдалённо напоминает перемещение указателя ветки в git, но snapshot-ы Iceberg остаются доступными до явного `expire_snapshots`.

Точный синтаксис stored procedure зависит от версии Iceberg и Spark — нужна проверка на стенде при реализации.

### Greenplum-параллель: отсутствие встроенного time travel

В PostgreSQL/Greenplum нет встроенных snapshot-ов на уровне таблицы. Для отката к предыдущему состоянию нужно:

- восстановление из бэкапа (`pg_dump` / `pg_restore`) — медленно, затрагивает всю базу;
- Point-in-Time Recovery (PITR) — сложная настройка, затрагивает весь кластер;
- ручной откат через «обратные» SQL-операции — хрупко и ненадёжно.

В Iceberg каждая операция с данными автоматически создаёт snapshot. Time travel — встроенная возможность формата, а не дополнительная инфраструктура.

### Cleanup

Демо-таблица `taxi_changes_demo` удаляется в конце модуля. Silver остаётся для Модуля 8. Колонка `loaded_at` — демонстрационный результат schema evolution; Модуль 8 не зависит от её наличия. Spark-сессия останавливается.

## План работ

1. Создать `notebooks/07_safe_table_changes.ipynb` по ячеечной структуре ниже.
2. Обновить `plans/README.md` — добавить строку Модуля 7 в таблицу оглавления.
3. Валидация: выполнить ноутбук сверху вниз на поднятом стенде после Модуля 6. Silver-таблица и Trino-доступ должны быть на месте.

## Структура ноутбука

### Секция 0: Введение

- **[md]** Заголовок, цели модуля, prerequisites (Модуль 6 пройден). Таблица-сравнение:

| | Классический DWH (Greenplum) | Lakehouse (Iceberg) |
|---|---|---|
| Добавить колонку | `ALTER TABLE ADD COLUMN` (мгновенно, NULL) | `ALTER TABLE ADD COLUMNS` (мгновенно, NULL) |
| Переименовать колонку | `ALTER TABLE RENAME COLUMN` | `ALTER TABLE RENAME COLUMN` |
| Откатить данные к вчерашнему состоянию | Восстановление из бэкапа (pg_dump / PITR) | `SELECT ... VERSION AS OF <snapshot_id>` |
| Посмотреть историю изменений таблицы | Нет встроенного механизма | `SELECT * FROM table.snapshots` |
| Последствия ошибочной записи | Нужен бэкап или ручной откат | Rollback к предыдущему snapshot |

- **[md]** Ключевая идея: Iceberg хранит полную историю изменений данных. Schema evolution и time travel — встроенные инструменты формата, а не дополнительная инфраструктура.
- **[md]** Как устроен этот ноутбук: schema evolution демонстрируем на silver-таблице (безопасная операция). Time travel и восстановление после ошибки — на отдельной демо-таблице (чтобы не рисковать данными для Модуля 8). Trino используется для проверки downstream-эффекта.

### Секция 1: Spark-сессия, Trino-клиент и проверка таблиц

- **[code]** SparkSession (паттерн Модулей 2-6). Константы: `SILVER_TABLE = "lakehouse.silver.nyc_taxi_yellow"`, `DEMO_TABLE = "lakehouse.default.taxi_changes_demo"`.
- **[code]** Assert: silver существует и непуста. Отсылка к Модулю 5.
- **[code]** Helper `trino_query(sql)` (паттерн Модуля 6). При `ImportError` — отсылка к Модулю 6: нужно пересобрать образ с `trino` пакетом.
- **[md]** Silver на месте, Trino готов. В этом модуле мы будем изменять таблицу и наблюдать последствия из обоих движков.

### Секция 2: Snapshot-ы — встроенная история изменений

- **[md]** В Модуле 4 мы впервые увидели snapshot-ы bronze-таблицы. Теперь разберёмся глубже. Каждая операция с данными в Iceberg (INSERT, overwrite, delete) автоматически создаёт snapshot — «снимок» состояния таблицы. Snapshot фиксирует, какие data files составляли таблицу в этот момент. Это как коммит в git: можно вернуться к любому предыдущему состоянию.
- **[code]** `spark.sql("SELECT snapshot_id, committed_at, operation, summary FROM lakehouse.silver.nyc_taxi_yellow.snapshots").show(truncate=False)`.
- **[code]** `spark.sql("SELECT * FROM lakehouse.silver.nyc_taxi_yellow.history").show(truncate=False)`.
- **[md]** Пояснение полей: `committed_at` — когда произошла операция, `operation` — тип (append, overwrite), `summary` — краткая статистика (added-data-files, total-records). Сейчас у silver один snapshot — от CTAS в Модуле 5. В Greenplum такой истории нет: после `INSERT` предыдущее состояние таблицы недоступно без бэкапа.

### Секция 3: Schema evolution — безопасное добавление колонки

- **[md]** Добавляем колонку `loaded_at` к silver. В PostgreSQL `ALTER TABLE ADD COLUMN` — обычная операция. В Iceberg — аналогично, но с важным свойством: Iceberg хранит историю схем. Добавление колонки — metadata-only операция: data files не перезаписываются, существующие строки получают NULL.
- **[md]** Важно: `ALTER TABLE ADD COLUMNS` НЕ создаёт новый data snapshot. Это изменение метаданных (schema), а не данных. Snapshot-ы фиксируют операции с данными (INSERT, DELETE, overwrite). Различие важно: time travel работает с data snapshot-ами, а не с версиями схемы.
- **[code]** Добавление колонки с защитой от повторного запуска:

```python
try:
    spark.sql("ALTER TABLE lakehouse.silver.nyc_taxi_yellow ADD COLUMNS (loaded_at TIMESTAMP)")
    print("Колонка loaded_at добавлена.")
except Exception as e:
    if "already exists" in str(e).lower():
        print("Колонка loaded_at уже существует (повторный запуск ноутбука). Продолжаем.")
    else:
        raise
```
- **[code]** Проверка через Spark: `spark.table(SILVER_TABLE).printSchema()` — новая колонка видна. `spark.sql("SELECT loaded_at FROM lakehouse.silver.nyc_taxi_yellow LIMIT 5").show()` — все значения NULL.
- **[md]** Колонка добавлена. Данные не изменились — Iceberg не перезаписывал data files. В PostgreSQL для nullable-колонок было бы так же: `ALTER TABLE ADD COLUMN` мгновенно, без перезаписи таблицы.
- **[md]** В рабочем сценарии `loaded_at` заполнялся бы при следующих INSERT-ах: `INSERT INTO ... SELECT ..., current_timestamp() AS loaded_at FROM ...`. Существующие строки остаются с NULL — это нормальная практика эволюции схемы. Заполнение существующих строк через UPDATE — отдельная тема, вне скоупа курса.
- **[md]** Примечание: если вы повторно запустите Модуль 5 после Модуля 7, `CREATE OR REPLACE TABLE` пересоздаст silver без колонки `loaded_at`. Это ещё одна иллюстрация того, почему `CREATE OR REPLACE` опасен в рабочих сценариях — он стирает все изменения, включая schema evolution.

### Секция 4: Downstream-эффект — Trino видит изменение

- **[md]** В Модуле 6 мы убедились: Spark и Trino читают одну таблицу через общий каталог. Schema evolution — ещё одно следствие: изменение схемы в Spark мгновенно видно в Trino. Не нужно «синхронизировать» или «обновлять» что-то на стороне Trino.
- **[code]** `trino_query("DESCRIBE lakehouse.silver.nyc_taxi_yellow")` — `loaded_at` присутствует в списке колонок.
- **[code]** `trino_query("SELECT loaded_at FROM lakehouse.silver.nyc_taxi_yellow LIMIT 5")` — NULL.
- **[md]** Trino увидел новую колонку мгновенно. Spark изменил метаданные в PostgreSQL (JDBC catalog), Trino прочитал обновлённые метаданные. Decoupled compute + общий каталог. _DBeaver: `DESCRIBE lakehouse.silver.nyc_taxi_yellow;`_

### Секция 5: Обзор операций schema evolution

- **[md]** `ADD COLUMN` — самая безопасная операция. Но Iceberg поддерживает и другие:

| Операция | Spark SQL | Безопасность | Влияние на downstream |
|---|---|---|---|
| Добавить колонку | `ALTER TABLE ADD COLUMNS (col type)` | Безопасно | Новая колонка с NULL, существующие запросы не ломаются |
| Переименовать колонку | `ALTER TABLE RENAME COLUMN old TO new` | Осторожно | Запросы с `SELECT old_name` перестают работать |
| Расширить тип | `ALTER TABLE ALTER COLUMN col TYPE bigint` | Безопасно | INT -> BIGINT: без потери данных |
| Сузить тип | — | Опасно | BIGINT -> INT: возможна потеря данных. Iceberg не поддерживает |
| Удалить колонку | `ALTER TABLE DROP COLUMN col` | Опасно | Запросы с `SELECT col` перестают работать |

- **[md]** В этом модуле мы продемонстрируем `RENAME COLUMN` на демо-таблице (Секция 9) и покажем, как это ломает downstream-запросы. `ALTER COLUMN TYPE` (расширение) и `DROP COLUMN` — вне скоупа курса, упоминаются для полноты.

### Секция 6: Подготовка демо-таблицы с несколькими snapshot-ами

- **[md]** Для экспериментов с time travel и восстановлением создаём отдельную таблицу. Silver не трогаем — он нужен для Модуля 8. Создаём таблицу с небольшим подмножеством silver и наращиваем snapshot-историю через `INSERT INTO`.
- **[code]** Удаление одноразовой демо-таблицы через `DROP TABLE IF EXISTS ... PURGE`, затем создание `lakehouse.default.taxi_changes_demo` через CTAS (1000 строк из silver). Явное удаление гарантирует один начальный snapshot при повторном запуске:

```python
spark.sql("DROP TABLE IF EXISTS lakehouse.default.taxi_changes_demo PURGE")
spark.sql("""
    CREATE TABLE lakehouse.default.taxi_changes_demo
    USING iceberg AS
    SELECT VendorID, tpep_pickup_datetime, tpep_dropoff_datetime,
           passenger_count, trip_distance, fare_amount, total_amount,
           pickup_borough, pickup_zone
    FROM lakehouse.silver.nyc_taxi_yellow
    LIMIT 1000
""")
```

- **[code]** Проверка: count = 1000. Snapshot-ы: 1 snapshot (`append` от CTAS).
- **[code]** INSERT ещё 500 строк -> snapshot 2:

```python
spark.sql("""
    INSERT INTO lakehouse.default.taxi_changes_demo
    SELECT VendorID, tpep_pickup_datetime, tpep_dropoff_datetime,
           passenger_count, trip_distance, fare_amount, total_amount,
           pickup_borough, pickup_zone
    FROM lakehouse.silver.nyc_taxi_yellow
    WHERE pickup_borough = 'Manhattan'
    LIMIT 500
""")
```

- **[code]** Проверка: count = 1500. Snapshot-ы: 2 snapshot-а. Вывод `snapshot_id` обоих с сохранением в переменные `snapshot_1`, `snapshot_2`.
- **[md]** Теперь у таблицы два snapshot-а: начальная загрузка (1000 строк) и добавление (500 строк). Это как два коммита в git. Каждый фиксирует конкретное состояние таблицы.

### Секция 7: Time travel — чтение предыдущих состояний

- **[md]** Центральная возможность Iceberg: можно прочитать таблицу в том состоянии, в каком она была на момент любого snapshot-а. Это time travel. В Greenplum для этого пришлось бы восстанавливать бэкап целой базы.

#### 7a: Time travel через Spark

- **[code]** Чтение snapshot 1 (начальная загрузка, 1000 строк):

```python
spark.sql(f"""
    SELECT count(*) AS row_count
    FROM lakehouse.default.taxi_changes_demo
    VERSION AS OF {snapshot_1}
""").show()
```

- **[code]** Чтение текущего состояния (1500 строк) для сравнения.
- **[md]** Snapshot 1: 1000 строк. Текущий: 1500 строк. Данные из первого snapshot-а не потеряны — оба состояния доступны одновременно. Iceberg хранит все data files; snapshot определяет, какие из них составляют таблицу в конкретный момент.

#### 7b: Time travel через Trino

- **[code]** Time travel через Trino:

```python
trino_query(f"""
    SELECT count(*) AS row_count
    FROM lakehouse.default.taxi_changes_demo
    FOR VERSION AS OF {snapshot_1}
""")
```

- **[md]** Trino тоже умеет time travel. Тот же snapshot, та же таблица, тот же каталог. Обратите внимание на синтаксис: Spark — `VERSION AS OF`, Trino — `FOR VERSION AS OF`. _DBeaver: `SELECT count(*) FROM lakehouse.default.taxi_changes_demo FOR VERSION AS OF <snapshot_id>;`_

#### 7c: Time travel по времени

- **[code]** Альтернативный способ — по timestamp:

```python
spark.sql(f"""
    SELECT count(*) AS row_count
    FROM lakehouse.default.taxi_changes_demo
    TIMESTAMP AS OF '{committed_at_1}'
""").show()
```

- **[md]** `VERSION AS OF` — точный (по snapshot_id). `TIMESTAMP AS OF` — удобный (по времени, Iceberg находит ближайший snapshot). Для точного отката лучше использовать snapshot_id.

### Секция 8: Намеренная ошибка и восстановление

- **[md]** Ключевой урок модуля. Студент намеренно вносит «плохие» данные, затем восстанавливает таблицу через rollback. Цель: ошибки в Iceberg — не катастрофа, если понимаешь snapshot-историю.

#### 8a: Вносим ошибку

- **[code]** INSERT «плохих» данных (200 строк с отрицательными fare_amount):

```python
spark.sql("""
    INSERT INTO lakehouse.default.taxi_changes_demo
    SELECT VendorID, tpep_pickup_datetime, tpep_dropoff_datetime,
           passenger_count, trip_distance,
           -99.99 AS fare_amount,
           -99.99 AS total_amount,
           'ERROR' AS pickup_borough,
           'BAD_DATA' AS pickup_zone
    FROM lakehouse.silver.nyc_taxi_yellow
    LIMIT 200
""")
```

- **[code]** Проверка: count = 1700. `SELECT count(*) ... WHERE fare_amount < 0` -> 200 строк. Таблица «испорчена».
- **[code]** Snapshot-история: 3 snapshot-а. Третий — ошибка.
- **[md]** В Greenplum: 200 строк с `fare = -99.99` в production-таблице -> звонок DBA, восстановление из бэкапа (если он есть и свежий), простой сервиса. В Iceberg: rollback.

#### 8b: Восстановление через rollback

- **[code]** Восстановление:

```python
spark.sql(f"""
    CALL lakehouse.system.rollback_to_snapshot(
        table => 'default.taxi_changes_demo',
        snapshot_id => {snapshot_2}
    )
""")
```

- **[code]** Проверка: count = 1500. `SELECT count(*) ... WHERE fare_amount < 0` -> 0. Таблица восстановлена.

#### 8c: Что произошло со snapshot-историей

- **[code]** `.snapshots`: по-прежнему 3 snapshot-а. `.history`: появилась четвёртая запись, снова указывающая на snapshot 2; ошибочный snapshot помечен `is_current_ancestor = false`.
- **[md]** Rollback не удаляет историю и файлы, но и не создаёт новый snapshot. Он переключает текущее состояние на существующий snapshot-предок. Сравнение:

| Свойство | `rollback_to_snapshot` | `CREATE OR REPLACE TABLE ... AS SELECT` |
|---|---|---|
| Создаёт новый snapshot | Нет | Да |
| Что становится текущим | Существующий snapshot-предок | Новый snapshot с результатом `SELECT` |
| Что происходит со старыми snapshot-ами | Сохраняются | Сохраняются для time travel |
| Цепочка предков | Возвращаемся к предку | Новый snapshot не имеет `parent_id`; прежние snapshot-ы перестают быть предками текущего |

- **[md]** `CREATE OR REPLACE` не создаёт отдельную именованную ветку: текущей остаётся `main`. Старые data files сохраняются до процедуры `expire_snapshots` — это тема Модуля 8.

### Секция 9: RENAME COLUMN и влияние на downstream

- **[md]** Покажем, что `RENAME COLUMN` — безопасная операция для данных, но опасная для downstream-запросов.
- **[code]** `spark.sql("ALTER TABLE lakehouse.default.taxi_changes_demo RENAME COLUMN pickup_borough TO borough")`.
- **[code]** Spark: `spark.table(DEMO_TABLE).printSchema()` — колонка теперь `borough`.
- **[code]** Trino: `trino_query("SELECT borough FROM lakehouse.default.taxi_changes_demo LIMIT 3")` -> работает.
- **[code]** Trino: запрос со старым именем `pickup_borough` (обернуть в try/except, чтобы показать ошибку):

```python
try:
    trino_query("SELECT pickup_borough FROM lakehouse.default.taxi_changes_demo LIMIT 3")
except Exception as e:
    print(f"Ошибка: {e}")
```

- **[md]** Данные не потеряны — колонка переименована в metadata. Но любой downstream-запрос, использовавший старое имя `pickup_borough`, сломается. В рабочем окружении перед `RENAME` нужно проверить, кто читает эту колонку. Параллель с PostgreSQL: `ALTER TABLE RENAME COLUMN` работает так же — запросы со старым именем перестают работать.

### Секция 10: Типичные ошибки новичка

- **[md]** Три ошибки, на которые обращает внимание PRD курса:

**Ошибка 1: Слепой `CREATE OR REPLACE`.**
В Модулях 4 и 5 мы использовали `CREATE OR REPLACE TABLE ... AS SELECT` для воспроизводимой полной загрузки bronze и silver. В `SparkCatalog` операция атомарно создаёт новый snapshot и сохраняет прежние snapshot-ы для time travel. Но она заменяет текущее содержимое, схему и partition spec. Новый snapshot не имеет `parent_id`, поэтому прежние snapshot-ы перестают быть предками текущего состояния. Если нужно перезаписать данные, сохранив текущую схему и партиционирование, следует использовать `INSERT OVERWRITE`.

**Ошибка 2: Изменение схемы без проверки downstream.**
`RENAME COLUMN` мы только что видели: данные целы, но запросы со старым именем ломаются. `ALTER COLUMN TYPE` (расширение INT -> BIGINT) безопасен для данных, но downstream-системы могут интерпретировать новый тип по-другому. Перед любым изменением схемы нужно понимать, кто читает эту таблицу.

**Ошибка 3: Отсутствие проверки snapshot-истории перед деструктивной операцией.**
Перед любой операцией, изменяющей данные, полезно посмотреть текущее состояние: `SELECT * FROM table.snapshots`. Это занимает секунды и даёт понимание, какой snapshot станет точкой отката в случае проблемы. Привычка: посмотрел snapshot-ы -> выполнил операцию -> проверил результат -> убедился, что новый snapshot создан.

### Секция 11: Самостоятельное задание

- **[md]** Готовим демо-таблицу с чистого листа. После демонстраций в Секциях 6-9 её схема изменена (RENAME), а snapshot-история содержит учебные эксперименты. Поскольку `CREATE OR REPLACE` сохраняет snapshot-ы, одноразовую таблицу удаляем через `PURGE` и создаём заново.
- **[code]** Сброс и новое создание демо-таблицы (тот же CTAS, что в Секции 6):

```python
spark.sql(f"DROP TABLE IF EXISTS {DEMO_TABLE} PURGE")
spark.sql("""
    CREATE TABLE lakehouse.default.taxi_changes_demo
    USING iceberg AS
    SELECT VendorID, tpep_pickup_datetime, tpep_dropoff_datetime,
           passenger_count, trip_distance, fare_amount, total_amount,
           pickup_borough, pickup_zone
    FROM lakehouse.silver.nyc_taxi_yellow
    LIMIT 1000
""")
print(f"Демо-таблица пересоздана: {spark.table(DEMO_TABLE).count()} строк, 1 snapshot.")
```

- **[md]** Пять задач на демо-таблице `taxi_changes_demo`.

  **Задача 1 (schema evolution).** Добавь колонку `quality_flag STRING` к демо-таблице через `ALTER TABLE ADD COLUMNS`. Проверь из Spark и из Trino, что колонка появилась и все значения NULL.

  **Задача 2 (создание snapshot).** INSERT 300 строк из silver (WHERE `pickup_borough = 'Brooklyn'`) в демо-таблицу. Проверь, что появился новый snapshot.

  **Задача 3 (time travel).** Посмотри snapshot-историю демо-таблицы. Прочитай таблицу в состоянии ДО добавления 300 строк (Задача 2) через `VERSION AS OF`. Сравни количество строк.

  **Задача 4 (recovery).** INSERT 100 строк с `fare_amount = -1` и `pickup_zone = 'STUDENT_ERROR'` в демо-таблицу. Убедись, что «плохие» строки появились (`SELECT count(*) WHERE fare_amount < 0`). Затем выполни `rollback_to_snapshot` к snapshot-у ДО этого INSERT-а. Проверь, что таблица восстановлена: `fare_amount < 0` -> 0 строк, общий count вернулся к предыдущему значению.

  **Задача 5 (ответ).** Сравни `rollback_to_snapshot` и `CREATE OR REPLACE TABLE ... AS SELECT * FROM table VERSION AS OF <snapshot_id>`: какая операция создаёт новый snapshot, что становится текущим и как меняется цепочка `parent_id`?

- **[code]** Пустая ячейка: `# Ваш код: ALTER TABLE ADD COLUMNS (quality_flag)`
- **[code]** Пустая ячейка: `# Ваш код: проверка из Spark и Trino`
- **[code]** Пустая ячейка: `# Ваш код: INSERT 300 строк из Brooklyn`
- **[code]** Пустая ячейка: `# Ваш код: snapshot-история`
- **[code]** Пустая ячейка: `# Ваш код: time travel — VERSION AS OF`
- **[code]** Пустая ячейка: `# Ваш код: INSERT 100 «плохих» строк`
- **[code]** Пустая ячейка: `# Ваш код: rollback_to_snapshot`
- **[code]** Пустая ячейка: `# Ваш код: проверка восстановления`
- **[md]** Пустая markdown-ячейка: `Ваш ответ на Задачу 5: ...`

- **[md]** Дополнительная задача (по желанию): Посмотри snapshot-историю silver-таблицы. Сколько snapshot-ов у неё? Какие операции их создали?
- **[code]** Пустая ячейка: `# Ваш код: snapshot-история silver`

### Секция 12: Checkpoint

- **[md]** Вопросы:
  1. Что такое snapshot в Iceberg и когда он создаётся?
  2. Создаёт ли `ALTER TABLE ADD COLUMNS` новый snapshot? Почему?
  3. Чем `ADD COLUMN` отличается от `RENAME COLUMN` по влиянию на downstream?
  4. Как прочитать предыдущее состояние таблицы? (назовите два способа)
  5. Что делает `rollback_to_snapshot`? Теряется ли при этом snapshot-история?
  6. Почему `CREATE OR REPLACE` опаснее, чем `INSERT INTO` с последующим rollback?
  7. Какой аналог time travel в PostgreSQL/Greenplum и почему он сложнее?

### Секция 13: Завершение

- **[md]** Удаляем демо-таблицу — она больше не нужна. Silver остаётся для Модуля 8 (колонка `loaded_at` — демонстрационная; Модуль 8 не зависит от её наличия).
- **[code]** `spark.sql("DROP TABLE IF EXISTS lakehouse.default.taxi_changes_demo PURGE")`.
- **[md]** Итог модуля:
  - Schema evolution (ADD COLUMN) — безопасная metadata-only операция, видна из всех движков.
  - Snapshot-ы — автоматическая история изменений данных, встроенная в Iceberg.
  - Time travel — чтение предыдущих состояний без бэкапов.
  - Rollback — восстановление после ошибки с сохранением истории.
  - В Модуле 8 — базовое обслуживание таблиц: compaction (проблема мелких файлов) и `expire_snapshots` (очистка старых snapshot-ов, которые мы научились использовать в этом модуле). Финальная практика.
- **[code]** `spark.stop()`.

### Дизайн-решения по ноутбуку

- **Исполняемый формат:** Spark SQL и PySpark для schema evolution и time travel. Trino-запросы через Python `trino` клиент для downstream-верификации.
- **DBeaver-подсказки:** markdown-заметки рядом с Trino-ячейками (паттерн Модуля 6).
- **Helper-код:** `trino_query(sql)` — переиспользование из Модуля 6. Snapshot_id сохраняются в Python-переменные для использования в time travel запросах.
- **Cleanup:** DROP демо-таблицы `taxi_changes_demo`. Silver остаётся (колонка `loaded_at` — демонстрационная, Модуль 8 не зависит от неё).
- **Порядок:** snapshots (обзор) -> schema evolution на silver -> downstream-проверка -> обзор операций -> демо-таблица -> time travel -> ошибка и recovery -> RENAME -> ошибки новичка -> самостоятельное задание.

## Checkpoint

Студент должен уметь:

- добавить колонку к Iceberg-таблице и проверить результат из Spark и Trino;
- объяснить, почему ADD COLUMN безопасна, а RENAME опасна для downstream;
- показать snapshot-историю таблицы и объяснить, что означает каждый snapshot;
- прочитать предыдущее состояние таблицы через time travel (`VERSION AS OF`);
- восстановить таблицу после ошибки через `rollback_to_snapshot`;
- объяснить разницу между `rollback_to_snapshot` и `CREATE OR REPLACE`;
- назвать три типичные ошибки новичка при работе с Iceberg-таблицами.

## Acceptance Criteria

- `notebooks/07_safe_table_changes.ipynb` выполняется сверху вниз после прохождения Модуля 6 без внешних зависимостей (DBeaver не обязателен).
- Ноутбук содержит: демонстрацию schema evolution (`ADD COLUMN` на silver), time travel (`VERSION AS OF`), recovery (`rollback_to_snapshot`), демонстрацию влияния `RENAME COLUMN` на downstream.
- Методика курса: объяснение -> демонстрация -> самостоятельное повторение -> checkpoint.
- Паттерны Модулей 1-6: SparkSession с адресом кластера из `spark-defaults.conf`, `setLogLevel("ERROR")`, `trino_query()`.
- Schema evolution на silver: только `ADD COLUMN` (безопасная операция). Опасные операции — на демо-таблице.
- При отсутствии silver — assert с отсылкой к Модулю 5.
- Текст на русском с параллелями к PostgreSQL/Greenplum.
- `plans/README.md` содержит строку Модуля 7.
- Демо-таблица `taxi_changes_demo` удаляется в конце модуля. Silver остаётся для Модуля 8 (колонка `loaded_at` — демонстрационная, Модуль 8 не зависит от её наличия).

## Риски

- **`rollback_to_snapshot` синтаксис.** Именованные параметры (`table => '...', snapshot_id => ...`) проверены на Spark 3.5.1 и Iceberg 1.10.0. `CREATE OR REPLACE TABLE ... AS SELECT * FROM table VERSION AS OF <snapshot_id>` не является эквивалентом rollback: он переписывает данные в новый snapshot без родителя и может заменить схему и partition spec.
- **`ALTER TABLE ADD COLUMNS` vs `ADD COLUMN`.** В Spark SQL с Iceberg синтаксис — `ADD COLUMNS` (множественное число). Проверить на стенде.
- **Количество snapshot-ов silver.** После первого запуска Модуля 5 у silver будет 1 snapshot; каждый повторный `CREATE OR REPLACE` добавляет новый, сохраняя старые для time travel. `ADD COLUMN` не создаёт data snapshot, а демо-таблица наращивает snapshot-историю через INSERT.
- **Time travel через Trino.** Синтаксис `FOR VERSION AS OF <snapshot_id>` проверен на Trino 478 с общим JDBC-каталогом и MinIO.
- **Floating-point в snapshot_id.** Snapshot ID — длинное число (long). При передаче в f-string и SQL нужно убедиться, что Python не конвертирует его в float. Использовать `int(snapshot_id)`.
- **RENAME COLUMN ошибка в Trino.** Trino-запрос со старым именем колонки должен упасть с ошибкой. Обернуть в try/except с пояснением в markdown.
- **Повторный запуск.** `ALTER TABLE ADD COLUMNS (loaded_at TIMESTAMP)` упадёт, если колонка уже существует. Решение зафиксировано: обернуть в try/except с проверкой `"already exists"` в тексте ошибки (см. Секцию 3). Одноразовая демо-таблица перед каждой исходной CTAS удаляется через `DROP TABLE ... PURGE`, чтобы проверки числа snapshot-ов были воспроизводимы.
- **Сброс демо-таблицы.** Два последовательных цикла `DROP TABLE ... PURGE` + `CREATE TABLE ... AS SELECT` проверены на стенде: каждый цикл начинает историю ровно с одного snapshot-а.
- **Влияние на Модуль 8.** Колонка `loaded_at` — демонстрационная. Модуль 8 не должен от неё зависеть. Если студент перезапустит Модуль 5 после Модуля 7, silver будет без `loaded_at` — Модуль 8 должен работать в обоих случаях.

## Out of Scope

- `ALTER TABLE ALTER COLUMN TYPE` (widening/narrowing) — упоминается в обзорной таблице, не демонстрируется.
- `DROP COLUMN` — упоминается как опасная, не демонстрируется.
- `MERGE`, row-level `DELETE`, `UPDATE` — PRD: вне v1.
- Partition evolution — отложено (partition pruning вне v1).
- Deep dive в Iceberg metadata JSON / manifest files — PRD: вне v1.
- `expire_snapshots` / vacuum — тема Модуля 8.
- Schema evolution через Trino (запись через Trino вне курса).
- Branching / tagging в Iceberg — advanced feature, вне v1.
