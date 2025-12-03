#!/usr/bin/env python3
from pyspark.sql import SparkSession


TABLE = "lakehouse.default.spark_trino_smoke"


def main() -> None:
    spark = SparkSession.builder.appName("iceberg-smoke").getOrCreate()

    spark.sql("CREATE NAMESPACE IF NOT EXISTS lakehouse.default")
    spark.sql(f"DROP TABLE IF EXISTS {TABLE}")
    spark.sql(f"CREATE TABLE {TABLE} (id INT, payload STRING) USING iceberg")
    spark.sql(f"INSERT INTO {TABLE} VALUES (1, 'from_spark')")

    result = spark.sql(f"SELECT * FROM {TABLE} ORDER BY id")
    result.show(truncate=False)
    print(f"✔ Spark записал и прочитал таблицу {TABLE}")

    spark.stop()


if __name__ == "__main__":
    main()
