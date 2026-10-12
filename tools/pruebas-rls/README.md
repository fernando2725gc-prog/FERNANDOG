# Banco de pruebas de las políticas de seguridad

Las políticas de `../supabase-auth.sql` son el único sitio donde la
seguridad del sistema es real: todo lo demás —los roles de la interfaz, los
botones que aparecen o no— es una guía que ordena el trabajo, no una
barrera. Por eso se prueban contra un PostgreSQL de verdad y no a ojo.

No hace falta tocar Supabase: `01-andamiaje-supabase.sql` recrea lo que
Supabase da por hecho (los roles `anon` y `authenticated`, el esquema `auth`
y `auth.uid()` leyendo el mismo ajuste de sesión).

```bash
PG=/var/tmp/pgdata
/usr/lib/postgresql/16/bin/initdb -D $PG -A trust -U postgres
/usr/lib/postgresql/16/bin/pg_ctl -D $PG -o '-p 5433 -k /var/tmp' start

psql -h /var/tmp -p 5433 -U postgres -f 01-andamiaje-supabase.sql
psql -h /var/tmp -p 5433 -U postgres -f ../supabase.sql
psql -h /var/tmp -p 5433 -U postgres -f ../supabase-auth.sql
psql -h /var/tmp -p 5433 -U postgres -f 02-datos.sql
./ataque.sh
```

`ataque.sh` entra como entraría alguien con la consola del navegador
abierta: con la sesión de otra persona, pidiendo lo que no le toca. Son 40
comprobaciones en ocho bloques: que sin cuenta no se entra, que una cuenta
sin perfil no vale de nada, que nadie se inventa su propio rol, que un
proveedor solo ve y escribe lo suyo, que cada rol de planta escribe lo suyo,
que el resumen no filtra lo que las filas esconden, y que desactivar a
alguien le cierra la puerta.

Dos cosas que conviene recordar al escribir pruebas aquí:

- **Postgres rechaza de dos maneras.** Un `INSERT` contra `WITH CHECK` da
  error; un `UPDATE` o `DELETE` contra `USING` no da error: afecta a cero
  filas. La segunda es la que se olvida, y una prueba que solo mira si hubo
  error da por buena una política que no protege nada.
- **La cuenta la crea Supabase, no el navegador.** En las pruebas se inserta
  en `auth.users` como `postgres`, que es lo que hace GoTrue al registrar.

Este banco encontró un agujero real: Recepción y Producción podían escribir
en la colección `sistema` entera «para poder anotar en la bitácora», y con
eso sobrescribir `sistema/config` —los pesos por gaveta, los precios por
kilo y los rendimientos de las tres líneas, que es de donde sale cada cifra
del documento—.
