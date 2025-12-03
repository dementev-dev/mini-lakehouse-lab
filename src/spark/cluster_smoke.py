from pyspark.sql import SparkSession

spark = (
    SparkSession.builder
    .appName("test-cluster")
    .master("spark://spark-master:7077")  # важно: не local[*]
    .getOrCreate()
)

spark.range(0, 1000000).groupBy().sum().show()

spark.stop()
