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
| JupyterLab | `jupyter` | `8888` | основной интерфейс для ноутбуков и терминала |
| VS Code в браузере (code-server) | `ide` | `8889` | альтернативный интерфейс для тех же ноутбуков |

## Основные команды

Все команды выполняются в терминале хоста из корня репозитория.
Для первого запуска и настройки прав используй [START_HERE](../START_HERE.md),
для продолжения работы — [памятку учащегося](./study_workflow.md).

### Сборка и запуск

```bash
docker compose pull minio minio-init postgres trino
docker compose build
docker compose up -d
docker compose ps -a
```

JupyterLab и VS Code собираются и запускаются вместе; выбирать интерфейс
можно после старта стенда.

### Логи

```bash
docker compose logs -f spark-master
docker compose logs -f trino
docker compose logs -f minio
docker compose logs -f jupyter
docker compose logs -f ide
```

### Остановка и reset

| Действие | Команда | Что происходит с данными |
| --- | --- | --- |
| Пауза до следующего занятия | `docker compose stop` | Контейнеры остановлены, файлы и volumes сохранены |
| Продолжение | `docker compose up -d` | Сервисы запускаются с прежними данными |
| Удаление контейнеров и сети | `docker compose down` | Volumes и файлы на хосте сохраняются, состояние внутри удаленных контейнеров теряется |
| Полный сброс учебных данных | См. [отдельную инструкцию](./study_workflow.md#начать-с-чистых-данных) | Удаляются MinIO volume и каталог PostgreSQL |

Переменные Python и живые Spark-сессии после остановки нужно создать заново.

## Ресурсы и проверенная среда

Актуальный бюджет для учащегося приведен в
[системных требованиях](../START_HERE.md#системные-требования).
Он учитывает одновременную работу двух Spark worker-ов, драйвера в Jupyter, Trino,
MinIO и PostgreSQL. У каждого worker-а в Compose указаны 2 CPU и 2 ГБ для
приложений Spark; это не предел потребления всей JVM или контейнера.
Потребление при простое не показывает пик во время урока.

Проверка 19 октября 2026 года: Linux x86_64, Docker Engine, 6 CPU и около
11,1 ГиБ памяти, видимых Docker. Выполнены первый ноутбук в Chromium и проверка
Spark → Iceberg → Trino. Затем Trino проверен с лимитом контейнера 2 ГиБ и heap
1 ГиБ на трех месяцах Taxi: 9 554 778 строк bronze, 9 418 184 строк silver
и 265 зон. Запросы Модуля 6 и дополнительный JOIN со справочником прошли;
агрегаты и JOIN сверены со Spark. Пик памяти контейнера Trino по cgroup составил
около 1,25 ГиБ, событий OOM и перезапусков не было.

Наблюдавшийся суммарный пик памяти контейнеров без неактивного файлового кэша
составил около 5,44 ГиБ. Это измерение выбранного сценария, а не проверка всей
среды под общим лимитом 8 ГБ: память Docker daemon, ядра и других процессов
Linux/WSL2 в сумму не входит. Прогона всех восьми модулей под таким лимитом
не было. Docker Desktop и ARM64 в этой проверке не запускались.
Методика и результаты сохранены в [отчете проверки](../plans/trino-memory-validation.md).

Размеры локально собранных образов на этой машине: Spark — около 3,37 ГБ,
Jupyter — 3,72 ГБ, IDE — 4,90 ГБ. Jupyter включает слои Spark, IDE включает слои
Jupyter: складывать эти три числа для оценки места неправильно. IDE добавляет
около 1,18 ГБ. IDE вместе с отдельными образами Trino, PostgreSQL и MinIO дает
около 8,1 ГБ до учета кэша сборки, данных и особенностей хранилища Docker.
Поэтому перед первой сборкой нужен запас места сверх размера готовых образов.

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
docker compose exec jupyter python3 /opt/src/spark/cluster_smoke.py
```

### Trino

- Web UI: `http://localhost:8090`
- Контейнер ограничен 2 ГиБ RAM (`mem_limit: 2g`). `memswap_limit: 2g`
  отключает swap для него: одинаковое значение задает общий предел RAM + swap.
- В [`trino/jvm.config`](../trino/jvm.config) heap Java начинается с 512 МиБ
  и может вырасти до 1 ГиБ (`-Xms512M`, `-Xmx1G`). Остальная память контейнера
  оставлена для потоков, служебных структур JVM и буферов вне heap.

Эти ограничения относятся к Trino; у всего Compose-проекта общего лимита
памяти нет. Если контейнер достигнет жесткого предела, он может быть завершен
системой. Увеличение только heap без изменения бюджета контейнера уменьшает
запас для памяти вне heap. См. [лимиты Compose](https://docs.docker.com/reference/compose-file/services/#mem_limit)
и [настройку JVM Trino](https://trino.io/docs/current/installation/deployment.html#jvm-config).

После обновления этих файлов примени настройки из терминала хоста:

```bash
docker compose up -d --no-deps --force-recreate trino
docker compose ps -a trino
```

Дождись `healthy`. Эта операция пересоздает только Trino и применяет в том числе
изменения содержимого `jvm.config`; таблицы остаются в MinIO и PostgreSQL.

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

Стенд использует готовый образ `coollabsio/minio:RELEASE.2025-04-22T22-12-26Z`.
Это сторонняя [сборка из официальных исходников MinIO](https://github.com/coollabsio/minio),
которая содержит сервер и клиент `mc` версии `RELEASE.2025-08-13T08-35-41Z`.
Версия сервера предшествует [изменению встроенной консоли в мае 2025 года](https://github.com/minio/minio/releases/tag/RELEASE.2025-05-24T17-08-30Z).
Образ подходит для локального курса; это историческая
версия без текущих обновлений, не production-конфигурация.

В Compose закреплён digest индекса для AMD64 и ARM64:
`sha256:a4938f37f1be1841b8e7b627ad0207b265345fd0d063e42d7410c78af0e63e68`.
Сервисы `minio` и `minio-init` используют один образ. Компиляция MinIO и установка
Go не нужны. По умолчанию образ скачивается из GHCR без авторизации. Автор
публикует тот же digest в Docker Hub; резервный источник выбирается через
`MINIO_REGISTRY=docker.io` в `.env`. Подробности — в
[инструкции по доступу к репозиториям](./network_access.md).

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

Основной интерфейс курса: `http://localhost:8888`. Открой ноутбук из списка
файлов слева; ядро **Python 3 (ipykernel)** выполняется внутри `jupyter`.
Локальный Python или venv не нужен.

- Порт опубликован только на `127.0.0.1` хоста.
- Аутентификация и XSRF-проверка отключены для локального однопользовательского стенда.
- `./notebooks` смонтирован как `/opt/work` для чтения и записи.
- `./src` и `./data` доступны только для чтения как `/opt/src` и `/opt/data`.
- `PYTHONPATH=/opt/src`.

Для готового стенда на удалённой машине открой туннель в терминале своего компьютера:

```bash
ssh -N -L 8888:127.0.0.1:8888 user@host
```

Подставь свой SSH-адрес вместо `user@host`, оставь терминал открытым и перейди
на `http://localhost:8888`. Первый ноутбук:
`notebooks/01_environment_and_smoke_test.ipynb`. Перед Модулем 3 скачанный
на хост data bundle должен лежать в `./data/nyc_taxi`; в контейнере он доступен
как `/opt/data/nyc_taxi`.

### VS Code в браузере

Это альтернативный интерфейс, который запускается вместе с JupyterLab.
Используй его по желанию; основной маршрут курса описан для JupyterLab.

Открой `http://localhost:8889`. Сервис `ide` запускает code-server с установленными
расширениями Python и Jupyter. Python, ipykernel, Java, PySpark и зависимости курса
уже находятся в образе. Локальный Python или venv не нужен.

В рабочей области доступны ноутбуки, примеры из `src/` и документация. Репозиторий
смонтирован в `/opt/course` только для чтения, а его каталог `notebooks/` — для
чтения и записи. Так относительные ссылки между документами и ноутбуками работают
и внутри IDE. Пути `/opt/work`, `/opt/src`, `/opt/data` также доступны примерам курса.
Если сверху виден **Restricted Mode**, нажми **Manage → Trust** и закрой окно
Workspace Trust. Подтверди доверие только к своей копии учебного репозитория.
В папке **Ноутбуки** открой `01_environment_and_smoke_test.ipynb`, нажми
**Select Kernel → Python Environments** и выбери `/usr/bin/python3`. Это Python
внутри контейнера IDE. Расширение Jupyter запускает ядро там же; адрес отдельного
Jupyter Server вводить не требуется. Запускай ячейки через `Shift+Enter`, сохраняй
через **File → Save** (`Ctrl+S`; на macOS — `Cmd+S`). Терминал IDE тоже работает
внутри контейнера; команды `docker compose` выполняй на хосте стенда.

Совместимость зависит от браузера, его расширений и средств защиты на компьютере.
При проверке с Windows, Edge и Kaspersky сам редактор открывался, а ноутбук
блокировался дополнительной политикой безопасности страницы. Похожий случай
описан в [обсуждении code-server](https://github.com/coder/code-server/discussions/7457).
Если видишь `Error loading webview` или `Could not register service worker`
даже на `localhost`, продолжи в JupyterLab. Настраивать или отключать защиту
ради прохождения курса не требуется. Открытие окна VS Code само по себе
не подтверждает работу ноутбуков: проверь запуск ячейки и её вывод.

Порт IDE опубликован только на `127.0.0.1`, без пароля, для одного пользователя.
Открывай именно `localhost` или `127.0.0.1`: браузер считает их доверенным
контекстом даже по HTTP. Notebook webview использует service worker; при обращении
по обычному HTTP к IP сервера или имени в локальной сети этот механизм может
быть недоступен. Это ограничение secure context, отдельное от CORS и XSRF.
См. [secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)
и [webviews в code-server](https://coder.com/docs/code-server/FAQ#why-do-web-views-not-work).

Для стенда на удалённой машине используй SSH-туннель:

```bash
ssh -N -L 8889:127.0.0.1:8889 user@host
```

Затем открой `http://localhost:8889` на своём компьютере. Прямой доступ по
публичному адресу не входит в эту конфигурацию.

Образы собираются в порядке `spark-master → jupyter → ide` через Compose
`additional_contexts` (нужен Docker Compose 2.17+ и BuildKit). Версии code-server
и расширений зафиксированы в `ide/Dockerfile`; расширения скачиваются при сборке.
Автоматическое обновление расширений отключено, чтобы повторный запуск использовал
проверенные версии.

Файлы ноутбуков общие с JupyterLab, а ядра и переменные Python отдельные.
Перед сменой интерфейса сохрани ноутбук, выполни `spark.stop()` и останови ядро.
Не редактируй один файл в двух интерфейсах одновременно.

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
| `trino/jvm.config` | JVM Trino: heap до 1 ГиБ внутри контейнера с лимитом 2 ГиБ |
| `spark/Dockerfile` | образ Spark с Iceberg, S3A и Python-зависимостями |
| `jupyter/Dockerfile` | образ JupyterLab на базе Spark |
| `ide/Dockerfile` | code-server и расширения на базе образа Jupyter |
| `ide/lakehouse.code-workspace` | папки рабочей области и настройки Python |
| `docs/network_access.md` | источники образов и зависимостей, резервный registry и диагностика сети |
| `docs/study_workflow.md` | повседневная работа, сохранение состояния и диагностика ошибок |

## Smoke-тесты

### JupyterLab и первый ноутбук

Пройди [первый запуск ноутбука](../START_HERE.md#как-работать-с-ноутбуками):
открой Модуль 1, выбери **Python 3 (ipykernel)**, выполни ячейки и сверь вывод
Spark. После сохранения и повторного открытия вывод должен остаться в файле.

### Дополнительная IDE и Jupyter-ноутбук

На Linux с Docker Engine, после запуска стенда:

```bash
bash tests/browser_ide.sh
```

Проверка запускает Chromium в отдельном контейнере и проходит путь студента:
доверие рабочей области → открытие копии Модуля 1 → выбор Python → Run All →
вывод Spark в webview → сохранение → повторное открытие. Затем проверяет, что
все кодовые ячейки выполнились без ошибок и результат сохранился. Исходный
ноутбук не меняется. Скриншот остаётся в каталоге `/tmp/lakehouse-browser-check.*`,
путь печатается перед запуском. Docker Desktop этим скриптом не проверяется:
он использует Linux host networking.

Для проверки отдельного стенда можно задать `COMPOSE_FILE` и `IDE_URL`; по
умолчанию тест использует текущий Compose-проект и `http://localhost:8889`.

### 1. Проверка, что Spark-кластер жив

```bash
docker compose exec jupyter python3 /opt/src/spark/cluster_smoke.py
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
CALL lakehouse.system.expire_snapshots(
    table => '<namespace>.<table>',
    older_than => TIMESTAMP '<cutoff>',
    retain_last => N
);

-- Rollback (Модуль 7)
CALL lakehouse.system.rollback_to_snapshot(table => '<namespace>.<table>', snapshot_id => <id>);

-- Time travel (Модуль 7)
SELECT * FROM <table> VERSION AS OF <snapshot_id>;
```

Для `expire_snapshots` подставь в `<cutoff>` границу хранения истории в часовом поясе Spark-сессии. `retain_last` сохраняет минимум N последних snapshot-ов в цепочке предков текущего состояния, а не ограничивает всю историю числом N. Получение границы времени для учебного примера показано в [Модуле 8, Секции 4](../notebooks/08_maintenance_and_final_lab.ipynb).

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
- `study_workflow.md` — чтобы продолжить занятие, сохранить результат и разобраться с ошибкой.
- `stack_reference.md` — чтобы быстро вспомнить порты, команды, точки доступа, шпаргалку и smoke-тесты.
- `course_program.md` — чтобы понять учебную траекторию дальше первого модуля.
- `glossary.md` — чтобы вернуться к определению термина (storage, catalog, compute, snapshot и др.).
- `mentor_notes.md` — заметки для ведения курса с ментором (опционально).
