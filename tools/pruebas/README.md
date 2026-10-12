# Pruebas de la autenticación

`autenticacion.js` prueba la aplicación **tal cual se publica** contra un
PostgreSQL de verdad con las políticas de `../supabase-auth.sql`. Lo único
simulado es el reparto de tokens (`falsogotrue.js`): la API de Supabase Auth
no es donde está la seguridad, y fingirla permite probar sin tocar una cuenta
real ni depender de internet.

Lo que NO se finge es la base de datos. Unas políticas escritas en SQL solo
se pueden verificar ejecutándolas; contra una imitación en JavaScript lo que
se probaría es la imitación.

```bash
# 1. PostgreSQL con el esquema y las políticas (ver ../pruebas-rls/README.md)
PG=/var/tmp/pgdata
/usr/lib/postgresql/16/bin/initdb -D $PG -A trust -U postgres
/usr/lib/postgresql/16/bin/pg_ctl -D $PG -o '-p 5433 -k /var/tmp' start
psql -h /var/tmp -p 5433 -U postgres -f ../pruebas-rls/01-andamiaje-supabase.sql
psql -h /var/tmp -p 5433 -U postgres -f ../supabase.sql
psql -h /var/tmp -p 5433 -U postgres -f ../supabase-auth.sql

# 2. La aplicación servida como un sitio cualquiera
cd ../.. && python3 -m http.server 8199 &

# 3. Las pruebas
node autenticacion.js      # 27 comprobaciones de punta a punta
node sin-servidor.js       # qué pasa cuando la base no responde
```

`sin-servidor.js` cubre el caso que más fácil se olvida: una base
**configurada pero inalcanzable**, que es lo que ocurre dentro del artefacto
de Claude y lo que ocurriría en una caída. Encontró un fallo serio: la
pantalla pedía una contraseña que ningún servidor iba a comprobar, de modo
que no entraba nadie. Ahora la aplicación le pregunta a la base si la
autenticación está instalada y, si no la alcanza, vuelve al acceso local.

## Nota sobre el resto de las pruebas

Las otras 21 suites de navegador (recepción, producción, costeo, tiempos,
balance por etapa, exportación a Excel, identidad, almacén propio…) se
escribieron fuera del repositorio, en un directorio temporal, y se perdieron
al vaciarse. Verificaron todo el trabajo hasta aquí, pero hay que volver a
escribirlas. **Las nuevas van en esta carpeta**, que es lo que debió hacerse
desde el principio.
