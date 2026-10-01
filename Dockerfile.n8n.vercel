# Use the official n8n image
FROM n8nio/n8n:latest

# Vercel provides the PORT environment variable dynamically.
# n8n uses N8N_PORT to configure its listening port.
ENV N8N_PORT=$PORT

# Disable telemetry and enforce Postgres for persistence 
# (Vercel container functions are stateless between invocations)
ENV N8N_DIAGNOSTICS_ENABLED=false
ENV DB_TYPE=postgresdb
# These will be provided by Vercel Environment Variables:
# ENV DB_POSTGRESDB_DATABASE=...
# ENV DB_POSTGRESDB_HOST=...
# ENV DB_POSTGRESDB_PORT=...
# ENV DB_POSTGRESDB_USER=...
# ENV DB_POSTGRESDB_PASSWORD=...

# Vercel functions require a start command that binds to the port
CMD ["n8n", "start"]
