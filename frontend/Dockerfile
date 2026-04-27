FROM node:20-alpine

WORKDIR /app

COPY . .

# Install deps when package.json exists; otherwise install a tiny static server fallback.
RUN if [ -f package.json ]; then \
      npm ci || npm install; \
    else \
      npm install -g http-server; \
    fi

EXPOSE 3000

# If Next.js app exists, run it. Otherwise serve static files from /public.
CMD ["sh", "-c", "if [ -f package.json ]; then npm run dev -- --hostname 0.0.0.0 --port 3000; else http-server public -p 3000 -a 0.0.0.0; fi"]
