# Берем за основу контейнер, приготовленный для spark в spark/Dockerfile
FROM de-spark-iceberg:3.5.1

USER root
ENV DEBIAN_FRONTEND=noninteractive

# Только JupyterLab, без дополнительных пакетов
RUN pip3 install --no-cache-dir "jupyterlab==4.2.5"

# Создаём непривилегированного пользователя
ARG NB_USER=jovyan
ARG NB_UID=1000
ARG NB_GID=100

RUN if ! getent group ${NB_GID} >/dev/null; then groupadd --gid ${NB_GID} ${NB_USER}; fi \
 && useradd --uid ${NB_UID} --gid ${NB_GID} -m -s /bin/bash ${NB_USER} \
 && mkdir -p /opt/work \
 && chown -R ${NB_UID}:${NB_GID} /opt/work

USER ${NB_UID}:${NB_GID}
WORKDIR /opt/work
EXPOSE 8888

CMD ["jupyter", "lab", \
     "--ip=0.0.0.0", \
     "--port=8888", \
     "--no-browser", \
     "--NotebookApp.token=", \
     "--NotebookApp.password="]
