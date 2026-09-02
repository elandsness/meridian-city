# syntax=docker/dockerfile:1

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -e -B -e -C -o org.apache.maven.plugins:maven-dependency-plugin:3.6.1:go-offline
COPY src ./src
RUN mvn -q -e -B -e -C -o -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar

EXPOSE 8090

ENTRYPOINT ["java", \
    "-XX:+UseG1GC", \
    "-XX:+UseStringDeduplication", \
    "-XX:MaxGCPauseMillis=200", \
    "-Xms256m", \
    "-Xmx512m", \
    "-Djava.security.egd=file:/dev/urandom", \
    "-jar", "app.jar"]
