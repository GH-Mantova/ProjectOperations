PR #1086 — MIG-2 tender-tracker import — REJECT-AND-REDO (missing PrismaModule import)

The PR implements the core logic correctly but fails CI because admin-imports.module.ts does not import PrismaModule. The prompt explicitly requires this (line 71-72), and the service + controller both inject PrismaService. NestJS cannot resolve the dependency at runtime without the module import. Re-fire the prompt after confirming the agent fixes this one-line module import (or use the watcher to re-queue the prompt for immediate re-fire).
