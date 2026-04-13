# Deployment Guide

## Runtime shape

- self-hosted web frontend
- self-hosted NestJS API
- PostgreSQL database
- reverse-proxy compatible HTTP services

## Recommended deployment pattern

1. Build the frontend assets.
2. Build the API application.
3. Provide environment variables through the host or orchestrator.
4. Run PostgreSQL separately or through managed infrastructure.
5. Put a reverse proxy in front of the web and API services.

## Current limitation

Container images for the app services are not yet included in Module 1. Docker Compose currently provisions PostgreSQL for local development only.
