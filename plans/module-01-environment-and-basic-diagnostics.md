# Модуль 1. Вход в стенд и базовая диагностика

**Статус:** `Ready for validation`
**Последнее обновление:** `2026-03-06`

## Цель

Дать студенту безопасный и воспроизводимый вход в курс: он должен сам поднять локальный стенд, открыть основные веб-интерфейсы, выполнить Spark smoke test и понять первый маршрут диагностики проблем.

## Результат для студента

После прохождения модуля студент:

- поднимает стенд командами `docker compose build` и `docker compose up -d`;
- проверяет состояние контейнеров через `docker compose ps`;
- открывает `Spark UI`, `MinIO Console`, `Trino UI` и `JupyterLab`;
- запускает smoke test Spark-кластера и понимает, что именно он проверяет;
- знает, куда смотреть при первичной диагностике через логи и UI.

## Deliverables

- `plans/README.md` как индекс всех рабочих планов;
- `START_HERE.md` как канонический вход в курс до первого ноутбука;
- `notebooks/01_environment_and_smoke_test.ipynb` как канонический ноутбук Модуля 1;
- `src/spark/cluster_smoke.py` как общий helper и CLI smoke test;
- обновлённые ссылки и инструкции в `README.md` и `AGENTS.md`.

## План работ

1. Создать каталог `plans/` и зафиксировать в нём правила хранения и индекс.
2. Подготовить `START_HERE.md` с prerequisites, запуском, проверкой сервисов, входом в Jupyter и reset/restart шагами.
3. Расширить `src/spark/cluster_smoke.py` до reusable helper с функцией `run_cluster_smoke(spark) -> dict` и CLI `main()`.
4. Собрать `notebooks/01_environment_and_smoke_test.ipynb` по схеме `объяснение -> демонстрация -> самостоятельное повторение -> checkpoint`.
5. Перенести полезное содержимое из старого `spark-basic-test.ipynb` в новый ноутбук и убрать старый артефакт из активного маршрута.
6. Обновить `README.md` и `AGENTS.md`, чтобы новый вход и новый ноутбук стали каноническими.
7. Прогнать валидацию: smoke script должен проходить синтаксическую проверку, а ноутбук должен быть валидным `ipynb`.

## Checkpoint

Студент должен уметь:

- показать результат `docker compose ps`;
- открыть `Spark UI`, `MinIO Console`, `Trino UI` и `JupyterLab`;
- выполнить smoke test и объяснить, что он подтвердил;
- назвать роли `MinIO`, `PostgreSQL`, `Spark`, `Trino` и `Jupyter`;
- описать первый шаг диагностики, если не поднимается `trino` или `spark-master`.

## Acceptance Criteria

- `START_HERE.md` позволяет поднять стенд с нуля без обращения к `docs/archive/legacy_howto.md`;
- `notebooks/01_environment_and_smoke_test.ipynb` можно выполнить сверху вниз в поднятом Jupyter-окружении;
- один и тот же smoke helper используется из CLI и из ноутбука;
- в репозитории остаётся один канонический вход в Модуль 1;
- `plans/README.md` позволяет быстро найти модульный план и понять его статус.

## Риски

- Старые ссылки на `spark-basic-test.ipynb` могут остаться в инструкциях и создавать путаницу.
- Если smoke test будет слишком сложным, он перестанет быть быстрым диагностическим шагом.
- Если в ноутбуке окажутся host-level команды, студент может ошибочно пытаться запускать `docker compose` внутри Jupyter.

## Out of Scope

- загрузка raw-данных;
- разбор internals `Iceberg`;
- запросы к `Trino` как отдельная практика;
- `schema evolution`, `time travel`, `compaction`, `vacuum`.
