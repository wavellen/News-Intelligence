# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NewsIntel — Frontend Dockerfile
# Location: frontend/Dockerfile
#
# Railway service settings:
#   Root Directory  → frontend
#   Dockerfile Path → Dockerfile   (auto-detected from root dir)
#   Env var         → NEWSINTEL_API_URL = https://your-api.up.railway.app
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FROM nginx:1.27-alpine

# Root dir is frontend/ so '.' contains index.html, config.js, _redirects
COPY . /usr/share/nginx/html/

# Entrypoint hook: inject NEWSINTEL_API_URL into config.js at container start.
# Railway sets this env var; the sed replaces the placeholder line in config.js.
RUN printf '#!/bin/sh\n\
if [ -n "$NEWSINTEL_API_URL" ]; then\n\
  sed -i "s|window.NEWSINTEL_API_URL = .*|window.NEWSINTEL_API_URL = '"'"'${NEWSINTEL_API_URL}'"'"';|" /usr/share/nginx/html/config.js\n\
  echo "Injected NEWSINTEL_API_URL: ${NEWSINTEL_API_URL}"\n\
fi\n' > /docker-entrypoint.d/40-inject-api-url.sh \
 && chmod +x /docker-entrypoint.d/40-inject-api-url.sh

# nginx config: honour $PORT (Railway assigns a dynamic port).
# Written as a template so envsubst can substitute $PORT at runtime.
RUN printf 'server {\n\
    listen ${PORT:-80};\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

# CMD is defined in frontend/railway.toml startCommand so Railway uses the
# correct envsubst invocation. This CMD is a fallback for local docker runs.
CMD ["/bin/sh", "-c", "envsubst '$$PORT' < /etc/nginx/conf.d/default.conf > /tmp/nginx.conf && nginx -c /tmp/nginx.conf -g 'daemon off;'"]
