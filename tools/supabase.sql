-- ==========================================================================
-- supabase.sql — La base de datos de Acopia, entera
--
-- Pégalo en el «SQL Editor» de tu proyecto de Supabase y pulsa «Run». Se
-- puede volver a ejecutar sin romper nada: todo está escrito para no fallar
-- si ya existe.
--
-- Por qué una sola tabla y no una por colección: la app ya decide la forma
-- de cada registro y la valida antes de guardarlo. Una tabla por colección
-- obligaría a migrar la base cada vez que el TIC añade un campo, y eso en
-- mitad de un piloto es exactamente lo que no se quiere.
-- ==========================================================================

create table if not exists documentos (
  coleccion   text        not null,
  id          text        not null,
  datos       jsonb       not null,
  actualizado timestamptz not null default now(),
  primary key (coleccion, id)
);

-- Las consultas de la app siempre filtran por colección.
create index if not exists documentos_coleccion_idx on documentos (coleccion);

-- La fecha la pone la base, no el navegador: los relojes de los celulares
-- de la planta no están sincronizados y un reloj atrasado haría que un
-- cambio nuevo pareciera viejo y no llegara a los demás.
create or replace function marcar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado := now();
  return new;
end;
$$;

drop trigger if exists documentos_actualizado on documentos;
create trigger documentos_actualizado
  before insert or update on documentos
  for each row execute function marcar_actualizado();

-- El resumen que la app consulta cada pocos segundos: siete filas en vez de
-- toda la base. Si la cuenta y la fecha no cambiaron, no hay nada que
-- descargar. Un alta o una baja mueven `n`; una edición mueve `ultimo`.
create or replace view resumen_documentos as
  select coleccion, count(*)::int as n, max(actualizado) as ultimo
  from documentos
  group by coleccion;

-- ==========================================================================
-- Acceso
--
-- LEE ESTO. Lo que sigue deja la base ABIERTA a cualquiera que tenga la
-- dirección de la app: puede leer y escribir todo. Es lo correcto para la
-- demostración y para un piloto con datos de prueba, y es exactamente el
-- mismo nivel de exposición que ya tenía la app dentro de Claude.
--
-- NO es aceptable para los datos reales de la planta bajo acuerdo de
-- confidencialidad. Para eso hace falta Supabase Auth: cada persona entra
-- con su propia cuenta y las políticas se escriben contra `auth.uid()`.
-- El README lo explica en §11.
-- ==========================================================================

alter table documentos enable row level security;

drop policy if exists piloto_lectura on documentos;
create policy piloto_lectura on documentos
  for select to anon using (true);

drop policy if exists piloto_escritura on documentos;
create policy piloto_escritura on documentos
  for insert to anon with check (true);

drop policy if exists piloto_edicion on documentos;
create policy piloto_edicion on documentos
  for update to anon using (true) with check (true);

drop policy if exists piloto_borrado on documentos;
create policy piloto_borrado on documentos
  for delete to anon using (true);

-- La vista hereda los permisos de quien la creó, no la seguridad de la
-- tabla: hay que concederla a mano.
grant select on resumen_documentos to anon;
