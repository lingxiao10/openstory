#!/bin/bash
set -e

echo "Building backend..."
cd platform/backend
npm run build

echo "Building frontend..."
cd ../frontend
npm run build

echo "Build completed successfully!"
cd ../..
