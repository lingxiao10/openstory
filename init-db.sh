#!/bin/bash
cd "$(dirname "$0")/platform/backend"
npx ts-node --transpile-only src/initDb.ts
