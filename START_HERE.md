# START HERE

Этот документ нужен для первого входа в курс и прохождения Модуля 1: поднять стенд, проверить сервисы, открыть интерфейсы и выполнить базовый smoke test.

## Маршрут прохождения

1. Проверить prerequisites.
2. Собрать и поднять стенд.
3. Убедиться, что контейнеры живы.
4. Открыть основные UI.
5. Зайти в Jupyter и выполнить `notebooks/01_environment_and_smoke_test.ipynb`.
6. При проблемах использовать логи и шаги диагностики из этого документа.

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

- `./notebooks` смонтирован в контейнер как `/opt/work`;
- `./src` смонтирован read-only как `/opt/src`;
- `PYTHONPATH=/opt/src`, поэтому helper-скрипты из `src/` доступны для импорта в ноутбуках;
- первый ноутбук курса: `01_environment_and_smoke_test.ipynb`.

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

## Что делать дальше

- пройти `notebooks/01_environment_and_smoke_test.ipynb`;
- свериться с программой курса в `docs/course_program.md`;
- после прохождения Модуля 1 переходить к следующим учебным материалам.
