# ==============================================================
# PROCORE MATERIALS HUB - PRODUCTION DOCKERFILE
# Imagen ligera basada en Node.js Alpine optimizada para producción
# ==============================================================

FROM node:22-alpine

# Metadata
LABEL maintainer="Procore Materials Hub Team" \
      description="Recepción de materiales en obra integrada con Procore Daily Log API"

# Directorio de trabajo en el contenedor
WORKDIR /app

# Copiar configuración de dependencias
COPY package.json ./

# Copiar el código fuente y activos estáticos
COPY . .

# Variables de entorno por defecto en el contenedor
ENV NODE_ENV=production \
    PORT=4173

# Exponer el puerto de la aplicación
EXPOSE 4173

# Comprobación de salud del contenedor (Health Check para Docker / Cloud)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4173/health || exit 1

# Usar usuario no root para máxima seguridad
USER node

# Comando de inicio del servidor
CMD ["node", "server.js"]
