# Планы работ

Этот каталог хранит внутренние рабочие планы по развитию учебного курса.

## Правила хранения

- Формат: `living docs`.
- История изменений хранится в git.
- Именование файлов: `module-NN-<english-slug-from-module-title>.md`.
- В каждом плане фиксируются `Статус` и `Последнее обновление`.

## Оглавление

| Модуль | План | Статус | Целевые артефакты | Обновлён |
| --- | --- | --- | --- | --- |
| 1. Вход в стенд и базовая диагностика | [module-01-environment-and-basic-diagnostics.md](./module-01-environment-and-basic-diagnostics.md) | Ready for validation | `START_HERE.md`, `notebooks/01_environment_and_smoke_test.ipynb`, `src/spark/cluster_smoke.py` | 2026-03-06 |
| 2. Ментальная модель Lakehouse: storage, catalog, compute | [module-02-lakehouse-mental-model.md](./module-02-lakehouse-mental-model.md) | Ready for validation | `notebooks/02_lakehouse_mental_model.ipynb` | 2026-03-07 |
| 3. Raw-данные и первое чтение в Spark | [module-03-raw-ingest-and-first-read.md](./module-03-raw-ingest-and-first-read.md) | Ready for validation | `docker-compose.yml`, `.gitignore`, `START_HERE.md`, `docs/stack_reference.md`, `notebooks/03_raw_ingest_and_first_read.ipynb` | 2026-03-07 |
| 4. Первая рабочая Iceberg-таблица и слой bronze | [module-04-bronze-with-iceberg.md](./module-04-bronze-with-iceberg.md) | Draft | `notebooks/04_bronze_with_iceberg.ipynb` | 2026-03-07 |
| 5. Слой silver и воспроизводимые трансформации | [module-05-silver-layer.md](./module-05-silver-layer.md) | Draft | `notebooks/05_silver_layer.ipynb` | 2026-03-07 |
