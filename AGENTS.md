# Repository Guidelines

This repository contains a small teaching Lakehouse stack (Spark + Trino + Iceberg + MinIO) intended for demos and mentoring.

## Project Structure & Module Organization

- `docker-compose.yml`: orchestrates Spark, Trino, MinIO, PostgreSQL, and Jupyter.
- `spark/`: Spark image (`Dockerfile`) and `spark-defaults.conf`.
- `jupyter/`: Jupyter image (`Dockerfile`) based on the Spark image.
- `trino/`: catalog config, e.g. `trino/catalog/lakehouse.properties`.
- `src/`: PySpark and SQL examples split by engine (`src/spark/...`, `src/trino/...`).
- `notebooks/`: demo notebooks (mounted into Jupyter at `/opt/work`).
- `plans/`: internal living docs for implementation plans.

Keep new examples in `src/` or `notebooks/`, and avoid mixing configuration and code.

## Build, Test, and Development Commands

Run from the repo root:

- `docker compose build`: build custom Spark and Jupyter images.
- `docker compose up -d`: start the full stack in the background.
- `docker compose ps`: check container status.
- `docker compose down -v`: stop the stack and remove volumes (for a clean slate).

Use `docker compose logs -f <service>` when debugging (`spark-master`, `trino`, `minio`, etc.).

## Coding Style & Naming Conventions

- Python: PEP 8, 4-space indentation, snake_case for functions, lower_snake_case for files (e.g. `spark_join_demo.py`).
- SQL: uppercase keywords, `schema.table` naming, short English identifiers; comments may be in Russian.
- Compose/Docker: service names kebab-case (`spark-master`), env vars UPPER_SNAKE_CASE.
- Prefer small, focused examples; reuse helpers from `src/` in notebooks where possible.

## Testing Guidelines

There is no formal automated test suite yet. Validate changes by:

- building and starting the stack, then
- running `src/spark/cluster_smoke.py` or the SQL in `src/spark/iceberg_demo.sql`,
- opening `notebooks/01_environment_and_smoke_test.ipynb` in Jupyter and checking it runs end-to-end.

If you add tests, prefer `pytest` under `tests/` and mark slow, integration-heavy tests clearly.

## Commit & Pull Request Guidelines

- Commits: short, descriptive subject in Russian or English, present tense (e.g. `Спарк запускается, создаётся тестовая таблица`, `Add Iceberg join demo`).
- Keep changes small and focused; update `README.md` when behavior, ports, or images change.
- PRs should describe the problem, the solution, and any impact on local setup; include screenshots (Trino UI, MinIO, Jupyter) when UI changes are relevant.

## Agent-Specific Instructions

When editing as an automated agent:

- Respect this file and avoid large refactors without an explicit request.
- Preserve Russian user-facing text unless the change is explicitly about translation.
- Prefer minimal changes that keep the demo simple and robust for newcomers.
