# Legacy HOWTO: ранние лабораторные по Lakehouse-стенду

Этот документ сохранён как архивный материал и не является актуальным учебным маршрутом для курса `Lakehouse без магии`.

Зачем он сохранён:

* в нём есть полезные ранние учебные сценарии и привязка к существующим demo-скриптам;
* он помогает понять, как эволюционировал стенд и какие практики уже когда-то обкатывались;
* его можно использовать как reference при создании новых ноутбуков и стартовой документации.

Почему это legacy:

* документ был написан до текущего PRD и новой программы курса;
* он смешивает актуальные темы с темами вне обязательного трека `v1`, например с отдельной лабой про партиционирование;
* он не соответствует новой структуре материалов `README -> START_HERE -> course_program -> notebooks`.

Ниже сохранено исходное содержимое старого `HOWTO.md` почти без изменений.

---

# HOWTO: Учебные лабораторные по Lakehouse-стенду

Этот файл описывает пошаговые учебные сценарии (лабораторные работы), которые можно выполнять поверх стенда из `docker-compose.yml`.

Перед началом работ смотри разделы «Сборка и запуск» и «Доступ к сервисам» в `README.md` — там описано, как поднять стенд и на каких портах доступны Trino, MinIO, Spark и Jupyter.

Лабораторки опираются на примеры в `src/`:

- `src/spark/cluster_smoke.py` — проверка, что Spark-кластер жив.
- `src/spark/iceberg_demo.sql` — первая Iceberg-таблица в Spark.
- `src/spark/iceberg_smoke.py` — Spark создаёт Iceberg-таблицу и читает её.
- `src/trino/iceberg_smoke.sql` — Trino читает таблицу, созданную в Spark.

Все команды ниже выполняются из корня репозитория.

Краткая карта лабораторных:

- **Лаба 0** — стенд поднят, Spark-кластер жив.
- **Лаба 1** — первая Iceberg-таблица в Spark.
- **Лаба 2** — общий каталог Spark ↔ Trino.
- **Лаба 3** — партиционирование и эволюция схемы.
- **Лаба 4** — мини-ETL поверх Lakehouse (эскиз).

---

## Лаба 0. Стенд поднят, Spark-кластер жив

**Цель**

- Убедиться, что все контейнеры поднялись.
- Проверить, что Spark-кластер (master + workers) работает.

**Предусловия**

- Установлены Docker и Docker Compose.
- Репозиторий склонирован локально.

**Шаги**

1. Собрать и поднять стенд:

   ```bash
   docker compose build
   docker compose up -d
   ```

2. Проверить статус контейнеров:

   ```bash
   docker compose ps
   ```

   Ожидаем, что `spark-master`, `spark-worker-1`, `spark-worker-2` в статусе `Up`.

3. Запустить smoke-скрипт кластера из контейнера `spark-master`:

   ```bash
   docker compose exec spark-master \
     /opt/spark/bin/spark-submit /opt/src/spark/cluster_smoke.py
   ```

4. Открыть Web UI Spark:

- `http://localhost:8080` — мастер.
- `http://localhost:8081` и `http://localhost:8082` — воркеры.

**Ожидаемый результат**

- `cluster_smoke.py` выполняется без ошибок.
- В Web UI видно приложение, прошедшее через кластер.

---

## Лаба 1. Первая Iceberg-таблица из Spark

**Цель**

- Создать Iceberg-таблицу с помощью Spark SQL.
- Посмотреть файлы таблицы в MinIO (`warehouse/default/demo_tbl/...`).

**Предусловия**

- Стенд запущен (лаба 0 выполнена).

**Шаги**

1. Подключиться к Spark SQL в контейнере:

   ```bash
   docker compose exec -it spark-master \
     /opt/spark/bin/spark-sql
   ```

2. Выполнить учебный SQL-скрипт:

- Внутри интерактивной сессии `spark-sql`:

  ```sql
  :r /opt/src/spark/iceberg_demo.sql
  ```

- Либо одним вызовом (без интерактивного режима):

  ```bash
  docker compose exec spark-master \
    /opt/spark/bin/spark-sql -f /opt/src/spark/iceberg_demo.sql
  ```

3. Зайти в MinIO Console:

- Адрес: `http://localhost:9001`
- Учётные данные по умолчанию: `minioadmin / minioadmin` (см. `docker-compose.yml`).

4. Найти файлы таблицы:

- Бакет `lakehouse`.
- Префикс `warehouse/default/demo_tbl/`.
- Обратить внимание на структуру Iceberg: каталоги `metadata/`, `data/` и т.д.

**Ожидаемый результат**

- В Spark запрос

  ```sql
  SELECT * FROM lakehouse.default.demo_tbl;
  ```

  возвращает данные.

- В MinIO видна структура Iceberg-таблицы: служебные файлы и файлы данных.

---

## Лаба 2. Общий каталог Spark ↔ Trino

**Цель**

- Показать, что Spark и Trino используют общий Iceberg-каталог (метаданные в Postgres, данные в MinIO).
- Создать таблицу из Spark и прочитать её через Trino.

**Предусловия**

- Стенд запущен.
- Лаба 1 не обязательна, но полезна для понимания структуры файлов.

**Шаги**

1. Создать таблицу и записать данные из Spark (PySpark-скрипт):

   ```bash
   docker compose exec spark-master \
     /opt/spark/bin/spark-submit /opt/src/spark/iceberg_smoke.py
   ```

2. Убедиться в Spark, что таблица существует:

   ```bash
   docker compose exec -it spark-master \
     /opt/spark/bin/spark-sql
   ```

   В интерактивной сессии:

   ```sql
   USE lakehouse.default;
   SHOW TABLES;
   SELECT * FROM spark_trino_smoke;
   ```

3. Прочитать ту же таблицу из Trino:

- Вариант через заранее скопированный SQL-файл (как в README):

  ```bash
  docker compose cp src/trino/iceberg_smoke.sql trino:/tmp/
  docker compose exec trino trino --file /tmp/iceberg_smoke.sql
  ```

- Либо интерактивно внутри Trino CLI:

  ```bash
  docker compose exec -it trino trino --catalog lakehouse
  ```

  Внутри CLI:

  ```sql
  USE lakehouse.default;
  SHOW TABLES;
  SELECT * FROM spark_trino_smoke;
  ```

**Ожидаемый результат**

- Таблица `spark_trino_smoke` видна и в Spark, и в Trino.
- Данные совпадают (например, строка `1, from_spark`).

---

## Лаба 3. Партиционирование и эволюция схемы

**Цель**

- Показать, как Iceberg работает с партиционированием (фильтрация по partition key, уменьшение объёма чтения).
- Показать, как Iceberg поддерживает эволюцию схемы без сложных миграций.

**Предусловия**

- Стенд запущен.
- Желательно выполнить Лабы 1–2, чтобы уже была интуиция про Iceberg и общий каталог.

**Подготовленные примеры**

- `src/spark/partitioned_table_demo.sql` — создание партиционированной Iceberg-таблицы и вставка данных.
- `src/spark/schema_evolution_demo.sql` — демонстрация `ALTER TABLE` и добавления колонок.
- `src/trino/schema_evolution_demo.sql` — чтение той же таблицы с эволюцией схемы из Trino.
- `notebooks/03_partitioning_and_schema_evolution.ipynb` — интерактивный разбор тех же примеров в Jupyter.

**Вариант A: через Spark SQL и Trino CLI**

1. Создать партиционированную таблицу в Spark:

   ```bash
   docker compose exec spark-master \
     /opt/spark/bin/spark-sql -f /opt/src/spark/partitioned_table_demo.sql
   ```

2. Проверить в Spark, какие данные записаны по датам:

   ```bash
   docker compose exec -it spark-master \
     /opt/spark/bin/spark-sql
   ```

   Внутри интерактивной сессии:

   ```sql
   USE lakehouse.default;
   SELECT event_date, COUNT(*) AS cnt, SUM(amount) AS total_amount
   FROM partition_demo
   GROUP BY event_date
   ORDER BY event_date;
   ```

3. Подготовить таблицу с эволюцией схемы:

   ```bash
   docker compose exec spark-master \
     /opt/spark/bin/spark-sql -f /opt/src/spark/schema_evolution_demo.sql
   ```

4. Посмотреть схему и данные в Spark:

   ```bash
   docker compose exec -it spark-master \
     /opt/spark/bin/spark-sql
   ```

   Внутри:

   ```sql
   USE lakehouse.default;
   DESCRIBE TABLE schema_evolution_demo;
   SELECT * FROM schema_evolution_demo ORDER BY id;
   ```

5. Прочитать таблицу с эволюцией схемы из Trino:

   ```bash
   docker compose cp src/trino/schema_evolution_demo.sql trino:/tmp/
   docker compose exec trino trino --file /tmp/schema_evolution_demo.sql
   ```

**Вариант B: через Jupyter-ноутбук**

- Открыть `http://localhost:8888` и запустить ноутбук `03_partitioning_and_schema_evolution.ipynb`.
- Ноутбук:
  - создаёт SparkSession, подключённый к кластеру;
  - выполняет скрипты `partitioned_table_demo.sql` и `schema_evolution_demo.sql`;
  - показывает агрегаты по партициям и данные до/после эволюции схемы в интерактивном виде.

---

## Лаба 4. Мини-ETL поверх Lakehouse (эскиз)

Идея лабы — собрать end-to-end сценарий:

- есть сырые данные (CSV/JSON) в S3/MinIO;
- Spark читает raw-данные, чистит и пишет в Iceberg-таблицу;
- Trino делает поверх неё аналитику.

Планируемые компоненты:

- Папка с примерами сырых данных (например, `examples/raw/` в репозитории, затем загрузка в MinIO).
- `src/spark/etl_raw_to_iceberg.py` — мини ETL, записывающий данные в `lakehouse.default.events` или аналогичную таблицу.
- `src/trino/etl_analytics.sql` — несколько аналитических запросов поверх этой таблицы.

Детали реализации можно развивать по мере появления новых сценариев.
