#!/bin/bash
set -e

echo "Starting frontend server..."
exec node .output/server/index.mjs
