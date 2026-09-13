# Docker Local Development Environment

This directory contains Docker configurations for running local development infrastructure for TZIT Education ERP + LMS.

## Quick Start (PostgreSQL Database)

Start a dedicated PostgreSQL 16 container running on port `5433`:

```bash
docker compose -f docker/docker-compose.yml up -d
```

### Connection Details

- **Host**: `localhost`
- **Port**: `5433`
- **Database**: `tzit_lms_dev`
- **Username**: `postgres`
- **Password**: `postgrespassword`
- **Connection URL**: `postgresql://postgres:postgrespassword@localhost:5433/tzit_lms_dev?schema=public`

### Stop the Database

```bash
docker compose -f docker/docker-compose.yml down
```

To also remove stored volume data:
```bash
docker compose -f docker/docker-compose.yml down -v
```
