# START HERE

Этот документ нужен для первого входа в курс: поднять стенд, проверить сервисы, открыть интерфейсы, выполнить базовый smoke test и подготовить локальный data bundle для следующих модулей.

## Маршрут прохождения

1. Проверить prerequisites.
2. Собрать и поднять стенд.
3. Убедиться, что контейнеры живы.
4. Открыть основные UI.
5. Зайти в Jupyter и выполнить `notebooks/01_environment_and_smoke_test.ipynb`.
6. Перед Модулем 3 подготовить учебный датасет в `./data/nyc_taxi`.
7. При проблемах использовать логи и шаги диагностики из этого документа.

## Prerequisites

Нужно заранее установить:

- Docker;
- Docker Compose;
- современный браузер для UI;
- свободные порты на хосте.

Рекомендуемые ресурсы хоста:

- не менее `4 vCPU`;
- не менее `10 GB RAM`, иначе `Spark`, `Trino` и `Jupyter` могут стартовать нестабильно;
- хотя бы `8-10 GB` свободного места под образы и контейнеры.

## Порты стенда

| Сервис | Адрес | Зачем нужен |
| --- | --- | --- |
| Spark Master UI | `http://localhost:8080` | Проверка мастера Spark и подключённых worker-ов |
| Spark Worker 1 UI | `http://localhost:8081` | Проверка первого worker-а |
| Spark Worker 2 UI | `http://localhost:8082` | Проверка второго worker-а |
| Trino UI | `http://localhost:8090` | Проверка координатора Trino |
| MinIO API | `http://localhost:9000` | S3-compatible endpoint |
| MinIO Console | `http://localhost:9001` | Просмотр бакетов и файлов |
| JupyterLab | `http://localhost:8888` | Основная точка входа в практику |
| PostgreSQL | `localhost:5432` | JDBC-каталог Iceberg, нужен для диагностики |

## Быстрый запуск

Все команды выполняются из корня репозитория.

### 1. Собрать образы

```bash
docker compose build
```

Зафиксированные образы MinIO загружаются из `quay.io`; их версии и назначение описаны в [техническом reference](./docs/stack_reference.md#minio).

### 2. Поднять стенд

```bash
docker compose up -d
```

### 3. Проверить статус контейнеров

```bash
docker compose ps
```

Ожидаемое состояние:

- сервисы `spark-master`, `spark-worker-1`, `spark-worker-2`, `minio`, `postgres-iceberg`, `trino`, `jupyter` находятся в состоянии `Up`;
- однократные init-контейнеры вроде `minio-init` и `iceberg-catalog-init` могут завершиться после успешной инициализации.

## Куда заходить после старта

Открой в браузере:

- `http://localhost:8080` для `Spark Master UI`;
- `http://localhost:8090` для `Trino UI`;
- `http://localhost:9001` для `MinIO Console`;
- `http://localhost:8888` для `JupyterLab`.

Для входа в `MinIO Console` используй:

- логин: `minioadmin`;
- пароль: `minioadmin`.

Если интерфейсы открываются, переходи в Jupyter и запускай:

```text
notebooks/01_environment_and_smoke_test.ipynb
```

## Роли сервисов в стенде

| Сервис | Роль в модуле |
| --- | --- |
| `MinIO` | `storage`: объектное хранилище для данных и файлов Iceberg |
| `PostgreSQL` | `catalog`: хранит метаданные JDBC-каталога Iceberg |
| `Spark` | `compute`: выполняет PySpark и Spark SQL задания |
| `Trino` | `compute`: читает те же таблицы через общий каталог |
| `Jupyter` | Точка входа в учебные ноутбуки |

## Как работать в Jupyter

- JupyterLab доступен без логина только с хоста, на котором запущен стенд;
- при работе через VS Code Remote-SSH выбери `Existing Jupyter Server` и укажи `http://127.0.0.1:8888/`;
- token в адрес добавлять не нужно: аутентификация и XSRF-проверка отключены для локального одно-пользовательского сценария;
- `./notebooks` смонтирован в контейнер как `/opt/work`;
- `./src` смонтирован read-only как `/opt/src`;
- `./data` смонтирован read-only как `/opt/data`;
- `PYTHONPATH=/opt/src`, поэтому helper-скрипты из `src/` доступны для импорта в ноутбуках;
- первый ноутбук курса: `01_environment_and_smoke_test.ipynb`;
- локальный учебный data bundle для Модуля 3 должен быть доступен внутри Jupyter по пути `/opt/data/nyc_taxi`.

Ноутбуки берут адрес кластера из
[`spark/spark-defaults.conf`](./spark/spark-defaults.conf). Если изменил его,
перезапусти ядро и заново создай Spark-сессию. Повторный запуск ячейки с
`getOrCreate()` использует текущую сессию. При перезапуске ядра переменные Python
сбрасываются, а учебные таблицы и файлы сохраняются.

## Базовая диагностика

### Посмотреть список контейнеров

```bash
docker compose ps
```

### Посмотреть логи конкретного сервиса

```bash
docker compose logs -f spark-master
docker compose logs -f trino
docker compose logs -f minio
docker compose logs -f jupyter
```

### Типовые первые проверки

- `Spark UI` не открывается: проверь `docker compose ps` и логи `spark-master`.
- `Trino UI` не открывается: проверь `docker compose ps` и логи `trino`.
- `JupyterLab` не открывается: проверь `docker compose ps` и логи `jupyter`.
- `MinIO Console` не открывается: проверь `docker compose ps` и логи `minio`.
- smoke test падает из ноутбука: сначала убедись, что `spark-master` и worker-ы видны в `Spark UI`.

## Restart и reset

### Мягкий перезапуск стенда

```bash
docker compose down
docker compose up -d
```

### Полный reset с удалением данных

```bash
docker compose down -v
docker compose up -d
```

Используй полный reset, если хочешь пройти практику заново с чистого состояния.

## Подготовка учебного датасета (перед Модулем 3)

Перед `notebooks/03_raw_ingest_and_first_read.ipynb` нужно заранее скачать учебный data bundle на хост, а не изнутри ноутбука.

Скачай каноническое учебное подмножество `NYC TLC Yellow Taxi Trip Records`:

```bash
curl -fLo data/nyc_taxi/yellow_tripdata_2024-01.parquet \
  https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet
curl -fLo data/nyc_taxi/yellow_tripdata_2024-02.parquet \
  https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-02.parquet
curl -fLo data/nyc_taxi/yellow_tripdata_2024-03.parquet \
  https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-03.parquet
curl -fLo data/nyc_taxi/taxi_zone_lookup.csv \
  https://d37ci6vzurychx.cloudfront.net/misc/taxi_zone_lookup.csv
```

Проверь, что файлы на месте:

```bash
ls -lh data/nyc_taxi/
```

Минимальный набор для курса:

- `yellow_tripdata_2024-01.parquet`
- `yellow_tripdata_2024-02.parquet`
- `yellow_tripdata_2024-03.parquet`
- `taxi_zone_lookup.csv`

Если хочешь расширенный режим, можешь скачать все 12 месяцев `2024`, но основной маршрут курса и примеры опираются на первые 3 месяца.

## Подключение DBeaver к Trino (перед Модулем 6)

- Зачем: в Модуле 6 можно работать с Trino через DBeaver параллельно с ноутбуком — привычный SQL-интерфейс.
- Предусловие: DBeaver установлен (ссылка на [dbeaver.io/download](https://dbeaver.io/download/)). Необязателен — ноутбук работает без DBeaver.
- Шаги: New Database Connection -> Trino. Host: `localhost`. Port: `8090`. Database/Catalog: `lakehouse`. Username: любая строка (напр. `student`). Password: пусто. Test Connection -> Finish.
- Проверка: `SHOW SCHEMAS FROM lakehouse;`. Ожидаем: `bronze`, `default`, `information_schema`, `silver`.
- Troubleshooting: стенд поднят? контейнер `trino` Up? порт 8090 свободен?

## Что делать дальше

- пройти `notebooks/01_environment_and_smoke_test.ipynb`;
- пройти `notebooks/02_lakehouse_mental_model.ipynb`;
- подготовить data bundle по инструкции выше и пройти `notebooks/03_raw_ingest_and_first_read.ipynb`;
- свериться с программой курса в `docs/course_program.md`;
- после прохождения первых модулей переходить к следующим учебным материалам.
