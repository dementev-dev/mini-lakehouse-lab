# Модуль 6. Одна таблица, два движка: Spark и Trino

**Статус:** `Ready for validation`
**Последнее обновление:** `2026-03-07`

## Цель

Показать студенту главное практическое следствие архитектуры Lakehouse: таблица, записанная одним движком, может быть прочитана другим без копирования данных. Студент записывает таблицу через Spark, читает её же через Trino, сравнивает результаты и объясняет, почему это работает через общий каталог и общее хранилище.

## Результат для студента

После прохождения модуля студент:

- умеет записать таблицу через Spark и тут же прочитать её через Trino — без копирования данных;
- умеет выполнять SQL-запросы к Iceberg-таблицам из Trino (программно из ноутбука и через DBeaver);
- умеет сопоставить результаты одного и того же запроса из Spark и из Trino;
- понимает роль общего каталога (PostgreSQL JDBC) и общего хранилища (MinIO) в обеспечении доступа из разных движков;
- может объяснить отличие Lakehouse-модели (decoupled compute) от классического DWH (engine = storage).

## Deliverables

- `notebooks/06_spark_and_trino_on_same_table.ipynb` — основной ноутбук Модуля 6;
- обновление `jupyter/Dockerfile` — добавление `trino>=0.328` в pip install;
- обновление `START_HERE.md` — новая секция «Подключение DBeaver к Trino (перед Модулем 6)»;
- обновление `docs/stack_reference.md` — блок о подключении DBeaver к Trino;
- обновление `plans/README.md` — строка Модуля 6 в оглавлении.

## Зависимости

### Предусловия

- Стенд поднят и работает (Модуль 1).
- Студент прошёл Модуль 5: таблица `lakehouse.silver.nyc_taxi_yellow` существует (не менее 24 колонок; если студент выполнил расширенное задание Модуля 5 — колонок может быть больше, это нормально).
- Студент прошёл Модуль 4: таблица `lakehouse.bronze.nyc_taxi_yellow` существует.
- Рекомендуется: DBeaver установлен на хосте студента (или аналогичный SQL-клиент). Не обязателен — ноутбук самодостаточен через Python `trino` клиент.

### Что используют последующие модули

- Модуль 7 работает со schema evolution и time travel, используя и Spark, и Trino.
- Модуль 8 использует silver в финальной практике с проверкой через Trino.

## Дизайн-решения

### Два пути к Trino: ноутбук (основной) и DBeaver (параллельный)

PRD требует, чтобы ноутбук был самодостаточным учебником и тренажёром: демонстрации, самостоятельные задания и checkpoints — в ноутбуке ([course_prd.md:65-68](../docs/course_prd.md#L65)). Поэтому основной исполняемый путь к Trino — Python `trino` клиент в code cells. Ноутбук выполняется сверху вниз без внешних зависимостей.

DBeaver — рекомендуемый параллельный инструмент для тех, кто хочет работать в привычном SQL-интерфейсе. Инструкция по подключению добавляется в `START_HERE.md`. В ноутбуке каждый Trino-запрос сопровождается markdown-заметкой: «Этот же запрос можно выполнить в DBeaver». Это:

- подкрепляет идею decoupled compute: два разных клиента (Python, DBeaver) работают с одним движком;
- даёт студенту выбор привычного инструмента;
- не делает ноутбук зависимым от внешнего приложения.

### Python `trino` клиент: основной исполняемый путь

Пакет `trino>=0.328` добавляется в `jupyter/Dockerfile`. В начале ноутбука создаётся helper-функция `trino_query(sql)`, которая выполняет SQL через Trino и выводит результат. Все Trino-запросы в ноутбуке — исполняемые code cells через этот helper. Это обеспечивает воспроизводимость и проверяемость.

### Структура «aha-момента»: write → read

Два этапа:

1. **Сравнение существующих таблиц.** Spark читает silver, Trino читает silver — метрики совпадают. Устанавливает факт: общий каталог работает.
2. **Живой цикл write → read.** Spark создаёт новую таблицу (`lakehouse.default.borough_summary`) через CTAS. Trino тут же её читает — без синхронизации, без копирования. Студент видит причинно-следственную связь: записал → увидел. Это соответствует программе курса: «записать таблицу через Spark; прочитать ту же таблицу через Trino» ([course_program.md:204-205](../docs/course_program.md#L204)).

### Greenplum-параллель: decoupled vs monolithic

В Greenplum данные и движок — единая система. Чтобы другой инструмент прочитал те же данные, нужно подключиться через Greenplum или скопировать. В Lakehouse данные лежат снаружи в object storage, и любой движок с доступом к каталогу и хранилищу может их прочитать. Данные не заперты в одном движке.

### Cleanup: удаление демо-таблицы

Таблицы bronze и silver остаются для Модулей 7 и 8. Демо-таблица `lakehouse.default.borough_summary` удаляется в конце модуля — она нужна только для демонстрации write → read. Spark-сессия останавливается.

## План работ

1. Обновить `jupyter/Dockerfile`: добавить `"trino>=0.328"` в строку `pip3 install`.
2. Обновить `START_HERE.md`: добавить секцию «Подключение DBeaver к Trino (перед Модулем 6)» после секции «Подготовка учебного датасета».
3. Обновить `docs/stack_reference.md`: добавить блок о подключении через DBeaver в секцию «Trino».
4. Создать `notebooks/06_spark_and_trino_on_same_table.ipynb` по ячеечной структуре ниже.
5. Обновить `plans/README.md` — добавить строку Модуля 6.
6. Валидация: выполнить ноутбук сверху вниз на поднятом стенде после Модуля 5. Опционально: проверить DBeaver-подсказки из markdown в DBeaver на `localhost:8090`.

## Структура ноутбука

### Секция 0: Введение
- **[md]** Заголовок, цели модуля, prerequisites (Модуль 5 пройден). Если установлен DBeaver — можно подключить его к Trino по инструкции из START_HERE.md (необязательно). Таблица-сравнение:

| | Классический DWH (Greenplum) | Lakehouse |
|---|---|---|
| Где лежат данные | Внутри СУБД, на управляемых дисках | В объектном хранилище (MinIO), отдельно от движков |
| Где лежат метаданные | `pg_catalog` внутри той же СУБД | Внешний JDBC-каталог (PostgreSQL) + metadata в MinIO |
| Кто может читать таблицу | Только сама СУБД | Любой движок с доступом к каталогу и хранилищу |
| Чтобы дать доступ другому инструменту | Подключиться к СУБД или скопировать данные | Подключить тот же каталог — данные уже доступны |

- **[md]** Ключевая идея: в Lakehouse данные не заперты в одном движке. Spark записал таблицу, Trino может прочитать без копирования — общий каталог и общее хранилище. Это decoupled compute.
- **[md]** Как устроен этот ноутбук: Spark-код и Trino-запросы выполняются здесь, в Jupyter. Для Trino используется Python-клиент `trino`. Если у вас установлен DBeaver — каждый Trino-запрос можно выполнить и там (в markdown будут подсказки). Два движка — одни данные.

### Секция 1: Spark-сессия, Trino-клиент и проверка таблиц
- **[code]** SparkSession (паттерн Модулей 2-5). Константы: `SILVER_TABLE`, `BRONZE_TABLE`.
- **[code]** Assert: silver и bronze таблицы существуют и непусты. Отсылка к Модулям 4-5.
- **[code]** Helper-функция `trino_query(sql)`: подключается к Trino через Python `trino` клиент, выполняет SQL, выводит результат в табличном виде. Используется во всех последующих Trino-ячейках. Если падает с `ImportError` — нужно пересобрать образ (`docker compose build jupyter && docker compose up -d`).
- **[md]** Обе таблицы на месте. Spark может их читать. Trino-клиент готов. Вопрос: может ли Trino прочитать те же таблицы?

### Секция 2: Читаем silver через Spark — фиксируем метрики
- **[md]** Сначала получим числа из Spark. Потом сравним с Trino.
- **[code]** Spark SQL: `SELECT count(*), avg(fare_amount), avg(trip_distance), count(DISTINCT pickup_borough)`. Сохранение в переменную `spark_metrics`.
- **[code]** `spark.table(SILVER_TABLE).show(10, truncate=False)` — первые строки для визуального сравнения.
- **[md]** Запомни эти числа. Сейчас выполним тот же запрос через Trino.

### Секция 3: Навигация по каталогу через Trino
- **[code]** `trino_query("SHOW SCHEMAS FROM lakehouse")`. Trino видит те же namespace (bronze, silver, default), потому что читает тот же JDBC-каталог.
- **[md]** _DBeaver: тот же запрос можно выполнить в DBeaver, если он подключён к Trino по инструкции из START_HERE.md._
- **[code]** `trino_query("SHOW TABLES FROM lakehouse.silver")`. Ожидаем `nyc_taxi_yellow`.
- **[code]** `trino_query("DESCRIBE lakehouse.silver.nyc_taxi_yellow")`. Сравнить со схемой из Модуля 5 (не менее 24 колонок; если выполнено расширенное задание — может быть больше). Различия в нотации типов (varchar vs STRING, double vs DOUBLE) нормальны — это разница синтаксиса движков, не данных.

### Секция 4: «Aha-момент» — одни и те же данные
- **[md]** Центральный момент модуля. Trino читает таблицу, записанную Spark в Модуле 5.
- **[code]** `trino_query("SELECT * FROM lakehouse.silver.nyc_taxi_yellow LIMIT 10")`.
- **[md]** Данные, записанные Spark. Trino не копировал — прочитал из MinIO через metadata из каталога. _DBeaver: `SELECT * FROM lakehouse.silver.nyc_taxi_yellow LIMIT 10;`_
- **[code]** Trino-метрики: `trino_query("SELECT count(*) AS row_count, avg(fare_amount) AS avg_fare, avg(trip_distance) AS avg_distance, count(DISTINCT pickup_borough) AS boroughs FROM lakehouse.silver.nyc_taxi_yellow")`.
- **[code]** Вывод сохранённых Spark-метрик для удобного сравнения.
- **[md]** Ожидание: row_count совпадает точно, avg — с точностью до floating-point округления. Оба движка читают одни и те же data files из MinIO.

### Секция 5: Почему это работает — роль общего каталога
- **[md]** Мини-лекция (4-5 абзацев):
  - Общий каталог: оба движка подключены к PostgreSQL (`postgres-iceberg:5432/iceberg`). Spark создаёт запись — Trino читает ту же запись.
  - Общее хранилище: data files и metadata в MinIO (`s3://lakehouse/warehouse`). Оба движка имеют доступ к бакету.
  - Параллель с Greenplum: данные внутри СУБД, доступ только через Greenplum. В Lakehouse — данные снаружи, движки взаимозаменяемы.
  - Decoupled compute: добавить новый движок = подключить его к каталогу и хранилищу.

- **[md]** ASCII-диаграмма:

```
  ┌─────────────────┐     ┌──────────────────┐
  │  Spark (Jupyter) │     │  Trino (DBeaver)  │
  └────────┬────────┘     └────────┬──────────┘
           │                        │
           ▼                        ▼
  ┌──────────────────────────────────────────┐
  │  PostgreSQL (JDBC catalog)               │
  │  metadata_location -> s3://...           │
  └────────────────────┬─────────────────────┘
                       ▼
  ┌──────────────────────────────────────────┐
  │  MinIO (S3-compatible storage)           │
  │  metadata/ + data/ (Parquet files)       │
  └──────────────────────────────────────────┘
```

### Секция 6: Spark записывает — Trino читает (live write → read)
- **[md]** До этого мы читали таблицы, созданные в предыдущих модулях. Теперь — живой цикл: Spark создаёт таблицу прямо сейчас, и Trino её тут же видит. Это ключевое действие модуля: «записать таблицу через Spark; прочитать ту же таблицу через Trino» (программа курса).
- **[code]** Spark CTAS: создаём агрегатную таблицу `lakehouse.default.borough_summary`:

```python
spark.sql("""
    CREATE OR REPLACE TABLE lakehouse.default.borough_summary
    USING iceberg AS
    SELECT pickup_borough,
           count(*)         AS trips,
           avg(fare_amount) AS avg_fare,
           avg(trip_distance) AS avg_distance
    FROM lakehouse.silver.nyc_taxi_yellow
    WHERE pickup_borough IS NOT NULL
    GROUP BY pickup_borough
""")
spark.table("lakehouse.default.borough_summary").show()
```

- **[md]** Spark записал таблицу. Мы не делали никакой синхронизации. Видит ли Trino?
- **[code]** `trino_query("SELECT * FROM lakehouse.default.borough_summary ORDER BY trips DESC")`.
- **[md]** Trino видит таблицу мгновенно. Spark записал metadata в PostgreSQL и data files в MinIO. Trino прочитал тот же каталог — увидел таблицу. Никакого копирования, никакой синхронизации. _DBeaver: `SELECT * FROM lakehouse.default.borough_summary ORDER BY trips DESC;`_
- **[md]** Это и есть decoupled compute: один движок создал, другой прочитал. В Greenplum для этого пришлось бы либо подключиться к тому же движку, либо скопировать данные.

### Секция 7: Аналитические запросы в Trino
- **[md]** Trino как аналитический SQL-движок. Выполним несколько аналитических запросов.
- **[code]** `trino_query("SELECT pickup_borough, count(*) AS trips, avg(fare_amount) AS avg_fare, avg(trip_distance) AS avg_distance, avg(tip_amount) AS avg_tip FROM lakehouse.silver.nyc_taxi_yellow WHERE pickup_borough IS NOT NULL GROUP BY pickup_borough ORDER BY trips DESC")`.
- **[md]** _DBeaver: тот же запрос._
- **[code]** Топ зон посадки: `trino_query("SELECT pickup_zone, count(*) AS trips, avg(total_amount) AS avg_total FROM lakehouse.silver.nyc_taxi_yellow WHERE pickup_zone IS NOT NULL GROUP BY pickup_zone ORDER BY trips DESC LIMIT 10")`.
- **[code]** Тот же запрос (топ зон) через Spark SQL для сравнения.
- **[md]** Результаты совпадают (с точностью до floating-point). Два движка, одна таблица.

### Секция 8: Навигация по bronze из Trino
- **[md]** До этого bronze читали только из Spark. Проверим через Trino.
- **[code]** `trino_query("SHOW TABLES FROM lakehouse.bronze")`.
- **[code]** `trino_query("SELECT count(*) AS row_count FROM lakehouse.bronze.nyc_taxi_yellow")`.
- **[code]** `trino_query("SELECT * FROM lakehouse.bronze.nyc_taxi_yellow LIMIT 5")`.
- **[md]** Trino видит все таблицы из всех namespace каталога. Каталог — общий, хранилище — общее. _DBeaver: те же запросы._

### Секция 9: DBeaver — SQL-клиент для Trino (рекомендация)
- **[md]** В этом ноутбуке мы работали с Trino через Python-клиент — для воспроизводимости. В реальной аналитической работе Trino чаще используют через SQL-клиенты: DBeaver, DataGrip, DbVisualizer. DBeaver — де-факто стандарт для SQL, знакомый всем, кто работал с PostgreSQL/Greenplum.
- **[md]** Если DBeaver установлен и подключён (инструкция в START_HERE.md), попробуйте выполнить в нём любой запрос из этого модуля. Результат будет тот же — тот же протокол, тот же движок, та же таблица. Разница: DBeaver — для интерактивной SQL-работы, Python-клиент — для автоматизации и ноутбуков.

### Секция 10: Самостоятельное задание
- **[md]** Четыре задачи. Центральная — самостоятельный цикл write → read, как в Секции 6.

  **Задача 1 (Spark → write).** Создай через Spark новую агрегатную таблицу `lakehouse.default.zone_summary` с CTAS: для каждой `pickup_zone` посчитай `count(*)`, `avg(total_amount)`, `avg(tip_amount)` по silver-таблице (WHERE pickup_zone IS NOT NULL).

  **Задача 2 (Trino → read).** Прочитай `lakehouse.default.zone_summary` через Trino (Python-клиент или DBeaver). Убедись, что Trino видит таблицу без синхронизации.

  **Задача 3 (сравнение).** Выполни тот же агрегатный запрос напрямую по silver через Trino (без промежуточной таблицы). Сравни результат с `zone_summary`. Числа должны совпасть.

  **Задача 4 (ответ).** Ответь в markdown-ячейке: почему Trino увидел `zone_summary` сразу после создания через Spark? Какие три компонента стенда это обеспечивают? Что произошло бы, если бы у Trino был другой каталог?

- **[code]** Пустая ячейка: `# Ваш код (Spark): CREATE TABLE zone_summary`
- **[code]** Пустая ячейка: `# Ваш код (Trino): чтение zone_summary`
- **[code]** Пустая ячейка: `# Ваш код (Trino): тот же агрегат напрямую по silver`
- **[md]** Пустая markdown-ячейка: `Ваш ответ на Задачу 4: ...`
- **[code]** Cleanup: `spark.sql("DROP TABLE IF EXISTS lakehouse.default.zone_summary")`

- **[md]** Дополнительная задача (по желанию): аналитический запрос по bronze через Trino и через Spark, сравнение.
- **[code]** Пустая ячейка: `# Ваш код (Trino): аналитический запрос по bronze`
- **[code]** Пустая ячейка: `# Ваш код (Spark): тот же запрос по bronze`

### Секция 11: Что мы НЕ сравниваем
- **[md]** Ограничение: модуль не сравнивает Spark и Trino как движки. Не обсуждаем: какой быстрее, какой лучше, внутренние различия. Цель — показать, что оба работают с одной таблицей через общий каталог. Это свойство архитектуры Lakehouse, а не конкретного движка.

### Секция 12: Checkpoint
- **[md]** Вопросы:
  1. Почему Trino видит таблицы, созданные Spark, без синхронизации?
  2. Какие два компонента стенда общие для Spark и Trino?
  3. Чем доступ к данным в Lakehouse отличается от Greenplum?
  4. Нужно ли копировать данные, чтобы Trino прочитал таблицу Spark?
  5. Что такое «decoupled compute» в одном предложении?
  6. Если добавить третий движок (Flink), что нужно сделать, чтобы он увидел те же таблицы?
  7. Что произошло, когда Spark создал `borough_summary`, а Trino её тут же прочитал?

### Секция 13: Завершение
- **[md]** Удаляем демо-таблицу, она больше не нужна. Таблицы bronze и silver остаются для Модулей 7 и 8.
- **[code]** `spark.sql("DROP TABLE IF EXISTS lakehouse.default.borough_summary")`.
- **[md]** «В Модуле 7 — schema evolution и time travel. В Модуле 8 — финальная практика.»
- **[code]** `spark.stop()`.

### Дизайн-решения по ноутбуку

- **Исполняемый формат:** Spark-код и Trino-запросы (через Python `trino` клиент) — в code cells. Ноутбук выполняется сверху вниз без внешних зависимостей.
- **DBeaver-подсказки:** markdown-заметки рядом с Trino-ячейками: «этот же запрос можно выполнить в DBeaver».
- **Helper-код:** `trino_query(sql)` — единственный helper. Ноутбук проще предыдущих — основная работа в SQL.
- **Cleanup:** DROP демо-таблицы `borough_summary`.
- **Порядок:** Spark (метрики) -> Trino (сравнение) -> объяснение WHY -> write → read -> аналитика -> bronze -> DBeaver-рекомендация -> самостоятельное задание.

## Изменения инфраструктуры

### jupyter/Dockerfile

Добавить `"trino>=0.328"` в pip install (строка 8-11):

```dockerfile
RUN pip3 install --no-cache-dir \
      "jupyterlab==4.2.5" \
      "boto3>=1.35,<2" \
      "psycopg2-binary>=2.9,<3" \
      "trino>=0.328"
```

Чистый Python-пакет, без системных зависимостей. Используется для программного доступа к Trino из ноутбука.

### START_HERE.md

Новая секция после «Подготовка учебного датасета (перед Модулем 3)», перед «Что делать дальше»:

**«Подключение DBeaver к Trino (перед Модулем 6)»**

- Зачем: в Модуле 6 можно работать с Trino через DBeaver параллельно с ноутбуком — привычный SQL-интерфейс.
- Предусловие: DBeaver установлен (ссылка на dbeaver.io/download). Необязателен — ноутбук работает без DBeaver.
- Шаги: New Database Connection -> Trino. Host: `localhost`. Port: `8090`. Database/Catalog: `lakehouse`. Username: любая строка (напр. `student`). Password: пусто. Test Connection -> Finish.
- Проверка: `SHOW SCHEMAS FROM lakehouse;`. Ожидаем: `bronze`, `default`, `information_schema`, `silver`.
- Troubleshooting: стенд поднят? контейнер `trino` Up? порт 8090 свободен?

### docs/stack_reference.md

В секцию «Trino» добавить подсекцию «Подключение через DBeaver»:
- Host: `localhost`, Port: `8090`, Catalog: `lakehouse`, User: любая строка, Password: нет.
- Driver: Trino (встроен в DBeaver).
- Проверка: `SHOW SCHEMAS FROM lakehouse;`.

## Checkpoint

Студент должен уметь:

- записать таблицу через Spark и прочитать её через Trino (live write → read);
- прочитать одну и ту же таблицу из Spark и из Trino и показать совпадение метрик;
- объяснить, какие компоненты обеспечивают доступ из двух движков (PostgreSQL catalog + MinIO storage);
- объяснить, почему данные не нужно копировать между движками;
- объяснить разницу между monolithic (Greenplum) и decoupled (Lakehouse) подходом.

## Acceptance Criteria

- `notebooks/06_spark_and_trino_on_same_table.ipynb` выполняется сверху вниз после прохождения Модуля 5 без внешних зависимостей (DBeaver не обязателен).
- Ноутбук содержит живой цикл write → read: Spark создаёт таблицу, Trino читает.
- Методика курса: объяснение -> демонстрация -> самостоятельное повторение -> checkpoint.
- Паттерны Модулей 1-5: SparkSession с адресом кластера из `spark-defaults.conf`, `setLogLevel("ERROR")`.
- Trino-запросы — в исполняемых code cells через Python `trino` клиент. DBeaver-подсказки — в markdown.
- При отсутствии silver — assert с отсылкой к Модулю 5. Схема silver: не менее 24 колонок (допускается расширенная схема после Модуля 5).
- Текст на русском с параллелями к PostgreSQL/Greenplum.
- `jupyter/Dockerfile` содержит `trino>=0.328`.
- `START_HERE.md` содержит инструкцию по подключению DBeaver к Trino (рекомендуемый параллельный инструмент).
- `docs/stack_reference.md` содержит блок о подключении DBeaver.
- `plans/README.md` содержит строку Модуля 6.
- Демо-таблица `borough_summary` удаляется в конце модуля. Таблицы bronze и silver остаются для Модулей 7 и 8.

## Риски

- **DBeaver не установлен.** Не блокер — ноутбук самодостаточен через Python `trino` клиент. DBeaver рекомендуется как параллельный инструмент. В START_HERE.md ссылка на установку. Альтернативные SQL-клиенты (DataGrip, DbVisualizer) — аналогичное подключение. Fallback: Trino CLI (`docker compose exec -it trino trino --catalog lakehouse`).
- **Trino не видит таблицы.** Контейнер не поднят, PostgreSQL/MinIO недоступны. Диагностика через `docker compose ps` и логи. Пояснение в ноутбуке.
- **Различия типов между Spark и Trino.** STRING vs varchar, DOUBLE vs double — косметическая разница в синтаксисе, не в данных. Упомянуть в секции 3.
- **Floating-point различия в агрегатах.** `avg()` может дать незначительно разные последние знаки. Упомянуть как нормальное поведение.
- **Пакет `trino` требует пересборки образа.** Нужен `docker compose build jupyter`. Без пакета ноутбук не выполняется (ImportError в секции 1). Пояснение в markdown с командой пересборки.
- **Порт 8090 занят.** Стандартная диагностика в START_HERE.md.

## Out of Scope

- Глубокое сравнение Spark и Trino (performance, оптимизаторы).
- Запись данных через Trino (в курсе Trino только читает).
- Trino CLI как основной инструмент.
- Настройка Trino connector.
- dbt, Airflow, оркестрация.
- Партиционирование и partition pruning.
- Schema evolution через Trino — Модуль 7.
- Trino security, users, roles.
