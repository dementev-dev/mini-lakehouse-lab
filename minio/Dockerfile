# Сохраняем версии стенда после удаления исторических бинарных образов upstream.
FROM golang:1.22.8-bookworm AS build-base
ENV CGO_ENABLED=0 GOMAXPROCS=2
WORKDIR /src

FROM build-base AS build-minio
# RELEASE.2024-10-02T17-50-41Z
RUN curl -fL --retry 3 \
      https://codeload.github.com/minio/minio/tar.gz/ded0b19d97bb9f73f4d78382eb131ff80003e272 \
      -o /tmp/source.tar.gz \
 && echo '1619e07c52b91611f399f5415cdf5aa96d3beac418bb909db9d7b6f86bbcfb6f  /tmp/source.tar.gz' | sha256sum -c - \
 && tar -xzf /tmp/source.tar.gz --strip-components=1 \
 && rm /tmp/source.tar.gz
RUN go build -p 2 -trimpath -ldflags="-s -w \
      -X github.com/minio/minio/cmd.Version=2024-10-02T17:50:41Z \
      -X github.com/minio/minio/cmd.ReleaseTag=RELEASE.2024-10-02T17-50-41Z \
      -X github.com/minio/minio/cmd.CommitID=ded0b19d97bb9f73f4d78382eb131ff80003e272" \
      -o /out/minio .

FROM build-base AS build-mc
# RELEASE.2024-06-24T19-40-33Z
RUN curl -fL --retry 3 \
      https://codeload.github.com/minio/mc/tar.gz/3548007d5bd1ba8e2ed98f35d95c4776dd9a7ff9 \
      -o /tmp/source.tar.gz \
 && echo '760ac5bf7eb2e44a67a7dd1e5508853e54c10ca75f2b2f2385c5c227042436c5  /tmp/source.tar.gz' | sha256sum -c - \
 && tar -xzf /tmp/source.tar.gz --strip-components=1 \
 && rm /tmp/source.tar.gz
RUN go build -p 2 -trimpath -ldflags="-s -w \
      -X github.com/minio/mc/cmd.Version=2024-06-24T19:40:33Z \
      -X github.com/minio/mc/cmd.ReleaseTag=RELEASE.2024-06-24T19-40-33Z \
      -X github.com/minio/mc/cmd.CommitID=3548007d5bd1ba8e2ed98f35d95c4776dd9a7ff9" \
      -o /out/mc .

FROM debian:bookworm-slim AS runtime
COPY --from=build-base /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

FROM runtime AS minio
COPY --from=build-minio /out/minio /usr/local/bin/minio
COPY --from=build-minio /src/LICENSE /usr/share/doc/minio/LICENSE
EXPOSE 9000 9001
ENTRYPOINT ["minio"]

FROM runtime AS mc
COPY --from=build-mc /out/mc /usr/local/bin/mc
COPY --from=build-mc /src/LICENSE /usr/share/doc/mc/LICENSE
ENTRYPOINT ["mc"]
