# Технический reference стенда

Этот документ описывает сам стенд как runtime-среду: сервисы, порты, доступ, основные команды и smoke-тесты.

Если нужен первый student onboarding, используй [START_HERE.md](../START_HERE.md). Если нужна программа курса, используй [course_program.md](./course_program.md).

## Состав сервисов

| Сервис | Контейнер | Порт на хосте | Назначение |
| --- | --- | --- | --- |
| Spark master | `spark-master` | `7077`, `8080` | мастер Spark и его UI |
| Spark worker 1 | `spark-worker-1` | `8081` | первый worker Spark |
| Spark worker 2 | `spark-worker-2` | `8082` | второй worker Spark |
| Trino | `trino` | `8090` | SQL engine и Web UI |
| MinIO API | `minio` | `9000` | S3-compatible endpoint |
| MinIO Console | `minio` | `9001` | веб-консоль бакетов и объектов |
| PostgreSQL | `postgres-iceberg` | `5432` | JDBC-каталог Iceberg |
| JupyterLab | `jupyter` | `8888` | практические ноутбуки |

## Основные команды

Все команды выполняются из корня репозитория.

### Сборка и запуск

```bash
docker compose build
docker compose up -d
docker compose ps
```

### Логи

```bash
docker compose logs -f spark-master
docker compose logs -f trino
docker compose logs -f minio
docker compose logs -f jupyter
```

### Остановка и reset

```bash
docker compose down
docker compose down -v
```

`down -v` удаляет volumes и возвращает стенд в чистое состояние.

## Доступ к сервисам

### Spark

- Master UI: `http://localhost:8080`
- Worker UI: `http://localhost:8081` и `http://localhost:8082`
- Адрес Spark master внутри сети Docker Compose: `spark://spark-master:7077`

Адрес кластера (`spark.master`) и настройки доступа к Iceberg и MinIO заданы в
[`spark/spark-defaults.conf`](../spark/spark-defaults.conf). Docker подключает этот
файл к контейнеру Jupyter как `/opt/spark/conf/spark-defaults.conf`.

При первом вызове `getOrCreate()` Spark читает настройки и создает сессию.
Повторный вызов использует уже работающую сессию. Если изменил адрес кластера
или настройки в файле, перезапусти ядро ноутбука и снова выполни ячейки
с импортами и созданием сессии.

Фактический master и имя приложения доступны через `spark.sparkContext.master`
и `.appName`. Текущие SQL-настройки можно прочитать через `spark.conf.get(...)`.
В Spark 3.5.1 `spark.sql.session.timeZone` меняется через `spark.conf.set(...)`
без остановки сессии. Для нового имени приложения нужен новый SparkContext.

Пример запуска smoke-скрипта:

```bash
docker compose exec spark-master \
  /opt/spark/bin/spark-submit /opt/src/spark/cluster_smoke.py
```

### Trino

- Web UI: `http://localhost:8090`

CLI внутри контейнера:

```bash
docker compose exec -it trino trino --catalog lakehouse
```

Примеры первых команд:

```sql
SHOW CATALOGS;
SHOW SCHEMAS FROM lakehouse;
SHOW TABLES FROM lakehouse.default;
```

**Подключение через DBeaver:**
- Host: `localhost`, Port: `8090`, Catalog: `lakehouse`, User: любая строка, Password: нет.
- Driver: Trino (встроен в DBeaver).
- Проверка: `SHOW SCHEMAS FROM lakehouse;`.

### MinIO

- S3 endpoint: `http://localhost:9000`
- Console: `http://localhost:9001`
- логин: `minioadmin`
- пароль: `minioadmin`

Стенд использует зафиксированные исторические образы MinIO Server и `mc` из официального namespace `quay.io/minio`. Эти версии подходят для локального курса, но больше не получают обновлений upstream и не предназначены для production.

Бакет `lakehouse` обычно создаётся автоматически контейнером `minio-init`.

### PostgreSQL

Подключение с хоста:

```bash
psql -h localhost -p 5432 -U iceberg -d iceberg
```

Служебные таблицы JDBC-каталога создаёт `iceberg-catalog-init`.

Если нужен повторный запуск инициализации:

```bash
docker compose run --rm iceberg-catalog-init
```

### JupyterLab

- адрес: `http://localhost:8888`
- порт опубликован только на `127.0.0.1` хоста;
- аутентификация и XSRF-проверка отключены для локального одно-пользовательского стенда;
- через VS Code Remote-SSH используй `Existing Jupyter Server` с адресом `http://127.0.0.1:8888/` без token;
- `./notebooks` смонтирован как `/opt/work`
- `./src` смонтирован read-only как `/opt/src`
- `./data` смонтирован read-only как `/opt/data`
- `PYTHONPATH=/opt/src`

Первый ноутбук курса: `notebooks/01_environment_and_smoke_test.ipynb`.

Для Модуля 3 локально скачанный data bundle должен лежать на хосте в `./data/nyc_taxi` и будет доступен внутри Jupyter по пути `/opt/data/nyc_taxi`.

## Как связаны Spark, Trino, PostgreSQL и MinIO

- `Spark` использует каталог `lakehouse` через `JdbcCatalog`.
- `Trino` использует тот же каталог `lakehouse` через `iceberg.jdbc-catalog`.
- метаданные таблиц лежат в `PostgreSQL`;
- данные и metadata-файлы Iceberg лежат в `MinIO` в бакете `lakehouse`.

Именно поэтому таблица, созданная в `Spark`, может читаться в `Trino` без копирования данных.

## Где лежат ключевые конфиги

| Файл | Что задаёт |
| --- | --- |
| `docker-compose.yml` | состав сервисов, порты, volumes, init-контейнеры |
| `spark/spark-defaults.conf` | Spark master, catalog `lakehouse`, `s3a`, Iceberg extensions |
| `trino/catalog/lakehouse.properties` | каталог Trino `lakehouse`, JDBC и S3-доступ |
| `spark/Dockerfile` | образ Spark с Iceberg, S3A и Python-зависимостями |
| `jupyter/Dockerfile` | образ JupyterLab на базе Spark |

## Smoke-тесты

### 1. Проверка, что Spark-кластер жив

```bash
docker compose exec spark-master \
  /opt/spark/bin/spark-submit /opt/src/spark/cluster_smoke.py
```

### 2. Проверка Spark -> Trino через общий каталог

```bash
docker compose cp src/spark/iceberg_smoke.py spark-master:/tmp/
docker compose cp src/trino/iceberg_smoke.sql trino:/tmp/
docker compose exec spark-master /opt/spark/bin/spark-submit /tmp/iceberg_smoke.py
docker compose exec trino trino --file /tmp/iceberg_smoke.sql
```

Ожидаемый результат:

- в Spark создаётся `lakehouse.default.spark_trino_smoke`;
- в Trino видна та же таблица;
- выборка возвращает строку `1, from_spark`.

Опциональная очистка:

```bash
docker compose exec spark-master \
  /opt/spark/bin/spark-sql -e "DROP TABLE IF EXISTS lakehouse.default.spark_trino_smoke"
```

## Краткая шпаргалка

### Ключевые S3-пути курса

| Путь | Назначение |
| --- | --- |
| `s3a://lakehouse/raw/nyc_taxi/` | raw-зона: исходные Parquet и CSV |
| `s3a://lakehouse/warehouse/bronze/` | bronze-таблицы Iceberg |
| `s3a://lakehouse/warehouse/silver/` | silver-таблицы Iceberg |

### Основные таблицы курса

| Таблица | Создаётся в |
| --- | --- |
| `lakehouse.bronze.nyc_taxi_yellow` | Модуль 4 |
| `lakehouse.bronze.taxi_zone_lookup` | Модуль 4 (самостоятельное задание) |
| `lakehouse.silver.nyc_taxi_yellow` | Модуль 5 |

### Часто используемые Spark SQL

```sql
-- Просмотр структуры каталога
SHOW TABLES IN lakehouse.bronze;

-- Метаданные Iceberg
SELECT * FROM <table>.snapshots;
SELECT * FROM <table>.files;

-- Обслуживание (Модуль 8)
CALL lakehouse.system.rewrite_data_files(table => '<namespace>.<table>');
CALL lakehouse.system.expire_snapshots(table => '<namespace>.<table>', retain_last => N);

-- Rollback (Модуль 7)
CALL lakehouse.system.rollback_to_snapshot(table => '<namespace>.<table>', snapshot_id => <id>);

-- Time travel (Модуль 7)
SELECT * FROM <table> VERSION AS OF <snapshot_id>;
```

### Часто используемые Trino SQL

```sql
SHOW SCHEMAS FROM lakehouse;
SHOW TABLES FROM lakehouse.silver;
DESCRIBE lakehouse.silver.nyc_taxi_yellow;

-- Time travel (синтаксис Trino)
SELECT * FROM <table> FOR VERSION AS OF <snapshot_id>;
```

### Монтирование (хост → контейнер)

| Хост | Контейнер | Режим |
| --- | --- | --- |
| `./notebooks` | `/opt/work` | read-write |
| `./src` | `/opt/src` | read-only |
| `./data` | `/opt/data` | read-only |

## Когда какой документ использовать

- `README.md` — чтобы понять, что это за репозиторий и куда идти дальше.
- `START_HERE.md` — чтобы впервые поднять стенд и пройти Модуль 1.
- `stack_reference.md` — чтобы быстро вспомнить порты, команды, точки доступа, шпаргалку и smoke-тесты.
- `course_program.md` — чтобы понять учебную траекторию дальше первого модуля.
- `glossary.md` — чтобы вернуться к определению термина (storage, catalog, compute, snapshot и др.).
- `mentor_notes.md` — заметки для ведения курса с ментором (опционально).
