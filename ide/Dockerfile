# Compose передаёт результат сборки jupyter через additional_contexts.
FROM jupyter-runtime

USER root
ARG CODE_SERVER_VERSION=4.141.0
ARG PYTHON_EXTENSION_VERSION=2026.4.0
ARG JUPYTER_EXTENSION_VERSION=2025.9.1

# Контрольные суммы .deb из выпуска code-server v4.141.0.
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) checksum=f384beb4f3ba207e0bca27d0dbd36dd825d5aa909d78c6d4baa8703eaf6b77ba ;; \
      arm64) checksum=0bca33a9b01180ad88f0b8969a8e34ae1c76417df471697e7cd65c20ef5dd60d ;; \
      *) echo "Unsupported architecture: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fL --retry 3 \
      "https://github.com/coder/code-server/releases/download/v${CODE_SERVER_VERSION}/code-server_${CODE_SERVER_VERSION}_${arch}.deb" \
      -o /tmp/code-server.deb; \
    echo "$checksum  /tmp/code-server.deb" | sha256sum -c -; \
    apt-get update; \
    apt-get install -y --no-install-recommends /tmp/code-server.deb; \
    rm -rf /tmp/code-server.deb /var/lib/apt/lists/*

USER jovyan
ENV HOME=/home/jovyan
RUN code-server --install-extension "ms-python.python@${PYTHON_EXTENSION_VERSION}" \
 && code-server --install-extension "ms-toolsai.jupyter@${JUPYTER_EXTENSION_VERSION}"

COPY lakehouse.code-workspace /opt/lakehouse.code-workspace
COPY --chown=jovyan settings.json /home/jovyan/.local/share/code-server/User/settings.json
EXPOSE 8889
CMD ["code-server", "--bind-addr", "0.0.0.0:8889", "--auth", "none", \
     "--disable-telemetry", "--disable-update-check", \
     "/opt/lakehouse.code-workspace"]
