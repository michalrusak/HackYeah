#!/bin/sh
set -e

API_URL="${WEB_API_URL:-/api}"
case "$API_URL" in
  /api|http://*|https://*) ;;
  /*) ;;
  *) API_URL="/${API_URL}" ;;
esac

printf '{"apiUrl":"%s"}\n' "$API_URL" > /usr/share/nginx/html/api-config.json
echo "[web] api-config.json -> ${API_URL}"
