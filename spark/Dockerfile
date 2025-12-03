FROM spark:3.5.1-scala2.12-java17-python3-ubuntu

USER root
ENV DEBIAN_FRONTEND=noninteractive

# Версии зависимостей в одном месте
ARG HADOOP_AWS_VERSION=3.3.4
ARG AWS_SDK_VERSION=1.12.262
ARG ICEBERG_VERSION=1.10.0
ARG POSTGRES_VERSION=42.7.3
ARG PYSPARK_VERSION=3.5.1

# Базовый Python/утилиты
RUN apt-get update \
 && apt-get install -y python3-pip curl wget nano mc tmux\
 && rm -rf /var/lib/apt/lists/*

# JAR'ы для S3A и Iceberg
RUN mkdir -p /opt/spark/jars \
 && curl -L "https://repo1.maven.org/maven2/org/apache/hadoop/hadoop-aws/${HADOOP_AWS_VERSION}/hadoop-aws-${HADOOP_AWS_VERSION}.jar" \
      -o "/opt/spark/jars/hadoop-aws-${HADOOP_AWS_VERSION}.jar" \
 && curl -L "https://repo1.maven.org/maven2/com/amazonaws/aws-java-sdk-bundle/${AWS_SDK_VERSION}/aws-java-sdk-bundle-${AWS_SDK_VERSION}.jar" \
      -o "/opt/spark/jars/aws-java-sdk-bundle-${AWS_SDK_VERSION}.jar" \
 && curl -L "https://repo1.maven.org/maven2/org/apache/iceberg/iceberg-spark-runtime-3.5_2.12/${ICEBERG_VERSION}/iceberg-spark-runtime-3.5_2.12-${ICEBERG_VERSION}.jar" \
      -o "/opt/spark/jars/iceberg-spark-runtime-3.5_2.12-${ICEBERG_VERSION}.jar" \
 && curl -L "https://repo1.maven.org/maven2/org/postgresql/postgresql/${POSTGRES_VERSION}/postgresql-${POSTGRES_VERSION}.jar" \
      -o "/opt/spark/jars/postgresql-${POSTGRES_VERSION}.jar"

# Общие Python-пакеты для драйвера и executors
RUN pip3 install --no-cache-dir \
      "pyspark==${PYSPARK_VERSION}" \
      pandas \
      numpy \
      pyarrow

ENV PYSPARK_PYTHON=python3
ENV PYSPARK_DRIVER_PYTHON=python3

# Конфиг Spark (S3 + Iceberg + каталог lakehouse)
RUN mkdir -p /opt/spark/conf
# Конфиги подключим уже в docker-compose
# COPY spark-defaults.conf /opt/spark/conf/spark-defaults.conf

# Возвращаемся к непривилегированному UID как в официальном образе
# (комментарий отдельно, чтобы не ломать USER)
# тот же пользователь, что в официальном spark-образе
USER 185
