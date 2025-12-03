# Берем за основу контейнер, приготовленный для spark в spark/Dockerfile
FROM de-spark-iceberg:3.5.1

USER root
ENV DEBIAN_FRONTEND=noninteractive

# Только JupyterLab, без дополнительных пакетов
RUN pip3 install --no-cache-dir "jupyterlab==4.2.5"

# Создаём непривилегированного пользователя
ARG NB_USER=jovyan
ARG NB_UID=1000

RUN useradd --uid ${NB_UID} -m -s /bin/bash ${NB_USER} \
 && mkdir -p /opt/work \
 && chown -R ${NB_UID}:${NB_UID} /opt/work

USER ${NB_UID}
WORKDIR /opt/work
EXPOSE 8888

CMD ["jupyter", "lab", \
     "--ip=0.0.0.0", \
     "--port=8888", \
     "--no-browser", \
     "--NotebookApp.token=", \
     "--NotebookApp.password="]
