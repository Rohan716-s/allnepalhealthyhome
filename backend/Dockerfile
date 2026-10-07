FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["backend.csproj", "."]
RUN dotnet restore "backend.csproj"
COPY . .
RUN dotnet publish "backend.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tesseract-ocr tesseract-ocr-eng tesseract-ocr-nep poppler-utils \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=6 \
    CMD curl --fail --silent --show-error http://localhost:8080/healthz || exit 1
ENTRYPOINT ["dotnet", "backend.dll"]
