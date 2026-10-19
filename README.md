# Lakehouse без магии

Практический курс, после которого ты будешь уверенно работать с Lakehouse-стеком: поднимать стенд, строить пайплайн `raw -> bronze -> silver`, читать одну таблицу из двух движков и не бояться изменений в данных.

## Что ты получишь

После прохождения 8 модулей ты умеешь:

1. **Поднимать и диагностировать** локальный Lakehouse-стенд — не по инструкции, а с пониманием, что и зачем работает.
2. **Объяснять архитектуру** `storage + catalog + compute` — и видеть, как знакомые концепции из PostgreSQL/Greenplum ложатся на новый стек.
3. **Строить пайплайн** `raw -> bronze -> silver` на реальном датасете NYC Taxi — с проверками качества и воспроизводимостью.
4. **Работать с двумя движками** — записывать данные через Spark, читать через Trino, и понимать, почему это работает без копирования.
5. **Безопасно менять таблицы** — schema evolution, time travel, rollback к предыдущему состоянию вместо паники.
6. **Обслуживать таблицы** — compaction и expire_snapshots, с пониманием параллелей к VACUUM/REORGANIZE.

Курс рассчитан на `~12-15 часов` самостоятельной работы. Каждый модуль: объяснение, демонстрация, самостоятельное задание, checkpoint.

## Стек

Всё работает локально в Docker. Для первой сборки и скачивания учебных данных
нужен интернет; облачный аккаунт не требуется.

```mermaid
graph TB
    U[Student / engineer]

    subgraph Access
        J[VS Code в браузере<br/>Jupyter notebooks / PySpark]
        Q[Trino UI / CLI<br/>ad hoc SQL]
    end

    subgraph Compute
        S[Spark cluster<br/>master + workers]
        T[Trino 478<br/>Iceberg connector]
    end

    subgraph Shared Services
        P[(PostgreSQL<br/>Iceberg JDBC catalog)]
        M[(MinIO<br/>S3-compatible)]
    end

    U --> J
    U --> Q
    J --> S
    Q --> T
    S --> P
    S --> M
    T --> P
    T --> M
```

| Компонент | Роль в стенде |
| --- | --- |
| `MinIO` | Storage — хранит данные и служебные файлы Iceberg |
| `PostgreSQL` | Catalog — метаданные JDBC-каталога `lakehouse` |
| `Spark` | Compute — ETL, запись и чтение Iceberg-таблиц |
| `Trino` | Compute — ad hoc SQL, чтение тех же таблиц |
| `code-server` | VS Code в браузере — ноутбуки курса, Python и терминал внутри Docker |
| `JupyterLab` | Запасной интерфейс для тех же ноутбуков |

Ноутбуки подключаются к Spark-кластеру с
[готовыми настройками стенда](./docs/stack_reference.md#spark).

## С чего начать

1. Открой [START_HERE.md](./START_HERE.md) — запуск стенда, диагностика, первый ноутбук.
2. Пройди `notebooks/01_environment_and_smoke_test.ipynb`.
3. Дальше по порядку: [docs/course_program.md](./docs/course_program.md).

Краткий запуск из корня репозитория:

```bash
docker compose pull minio minio-init postgres trino
docker compose build
docker compose up -d
docker compose ps
```

MinIO скачивается готовым из GHCR, его версия и digest закреплены. Если какой-то
источник недоступен из твоей сети, начни с
[инструкции по доступу к репозиториям](./docs/network_access.md).

После старта:

| UI | Адрес |
| --- | --- |
| VS Code в браузере | `http://localhost:8889` |
| JupyterLab (запасной интерфейс) | `http://localhost:8888` |
| Spark Master | `http://localhost:8080` |
| Trino | `http://localhost:8090` |
| MinIO Console | `http://localhost:9001` |

Открой ноутбук в браузерном VS Code и выбери Python внутри контейнера: локальный
Python и venv не нужны. Оба интерфейса доступны только с хоста стенда.
Первый запуск ноутбука описан в [START_HERE.md](./START_HERE.md#как-работать-с-ноутбуками).

## Документы для прохождения

- [START_HERE.md](./START_HERE.md) — первый маршрут: prerequisites, запуск, диагностика.
- [docs/course_program.md](./docs/course_program.md) — модульная структура и состав учебных материалов.
- [docs/stack_reference.md](./docs/stack_reference.md) — порты, команды, конфиги, шпаргалка.
- [docs/glossary.md](./docs/glossary.md) — справочник терминов (storage, catalog, compute, snapshot и др.).

## Менторство

Курс рассчитан на самостоятельное прохождение, но если хочешь разобрать темы глубже с ментором по Data Engineering — напиши: [@dementev_dev](https://t.me/dementev_dev).

## Лицензия

Материалы этого репозитория лицензированы на условиях Creative Commons Attribution 4.0 International (`CC BY 4.0`).
См. [LICENSE](./LICENSE).
