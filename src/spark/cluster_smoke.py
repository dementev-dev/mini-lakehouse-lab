from __future__ import annotations

from pyspark.sql import SparkSession

EXPECTED_MASTER_URL = "spark://spark-master:7077"
DEFAULT_APP_NAME = "cluster-smoke"
DEFAULT_ROW_COUNT = 1_000_000


def create_spark_session(
    app_name: str = DEFAULT_APP_NAME,
) -> SparkSession:
    """Создать SparkSession для проверок окружения в Модуле 1.

    Адрес кластера и настройки Iceberg и MinIO заданы в spark-defaults.conf.
    """
    return SparkSession.builder.appName(app_name).getOrCreate()


def run_cluster_smoke(spark: SparkSession, row_count: int = DEFAULT_ROW_COUNT) -> dict:
    spark_context = spark.sparkContext
    master_url = spark_context.master

    if master_url != EXPECTED_MASTER_URL:
        raise RuntimeError(
            "Smoke test must run against "
            f"{EXPECTED_MASTER_URL}, got {master_url}."
        )

    # Берём больше партиций, чем даёт defaultParallelism, чтобы задача точно
    # распределилась по worker-ам, а не схлопнулась в слишком маленький job.
    partition_count = max(spark_context.defaultParallelism * 2, 8)
    expected_sum = row_count * (row_count - 1) // 2
    actual_sum = (
        spark.range(0, row_count, 1, numPartitions=partition_count)
        .selectExpr("SUM(id) AS total_sum")
        .collect()[0]["total_sum"]
    )

    if actual_sum != expected_sum:
        raise RuntimeError(
            f"Unexpected smoke result: expected {expected_sum}, got {actual_sum}."
        )

    return {
        "app_name": spark_context.appName,
        "master_url": master_url,
        "spark_version": spark.version,
        "default_parallelism": spark_context.defaultParallelism,
        "partition_count": partition_count,
        "row_count": row_count,
        "result_sum": actual_sum,
        "expected_sum": expected_sum,
    }


def format_smoke_report(report: dict) -> str:
    return "\n".join(
        [
            "Spark cluster smoke test passed.",
            f"app_name={report['app_name']}",
            f"master_url={report['master_url']}",
            f"spark_version={report['spark_version']}",
            f"default_parallelism={report['default_parallelism']}",
            f"partition_count={report['partition_count']}",
            f"row_count={report['row_count']}",
            f"result_sum={report['result_sum']}",
            f"expected_sum={report['expected_sum']}",
        ]
    )


def main() -> None:
    spark = create_spark_session()
    try:
        report = run_cluster_smoke(spark)
        print(format_smoke_report(report))
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
