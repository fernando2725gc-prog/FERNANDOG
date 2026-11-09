-- ==========================================================================
-- supabase-auth.sql — Autenticación real y permisos en la base de datos
--
-- Hasta aquí, la contraseña se comprobaba en el navegador y los permisos
-- eran una guía: ordenaban el trabajo, pero no contenían a nadie. Quien
-- abriera la consola del navegador podía pedir lo que quisiera.
--
-- Lo que hace este archivo:
--
--   · Mueve la identidad a Supabase Auth. La contraseña se verifica en el
--     servidor y su hash no sale de allí nunca.
--   · Mueve los permisos a la base. Un proveedor que pida los lotes de otro
--     no recibe un error de la aplicación: recibe cero filas de Postgres.
--   · Impide que alguien se invente su propio rol. Un perfil solo se crea
--     si Supervisión dejó antes una invitación con ese rol, y el nombre de
--     acceso es único: una invitación sirve una sola vez.
--
-- Pégalo en el «SQL Editor» de Supabase y pulsa «Run». Se puede volver a
-- ejecutar sin romper nada.
--
-- ANTES, en Authentication → Providers → Email, hay que DESACTIVAR
-- «Confirm email». La gente de planta entra con un usuario y un PIN, no con
-- un correo que puedan abrir; el correo es solo la forma que tiene Supabase
-- de nombrar una cuenta.
-- ==========================================================================


-- ============================ 1. Quién es quién ===========================

-- El perfil es el puente entre la cuenta de Supabase (un uuid) y el usuario
-- de la planta (dandrade, PRV-001). Vive aparte de `documentos` para poder
-- consultarlo desde las políticas sin que se muerdan la cola.
create table if not exists perfiles (
  uid           uuid primary key references auth.users(id) on delete cascade,
  acceso        text not null unique,
  rol           text not null check (rol in ('supervisor','recepcion','produccion','proveedor')),
  proveedor_id  text,
  nombre        text not null,
  activo        boolean not null default true,
  creado        timestamptz not null default now(),
  -- Un proveedor sin finca asignada podría ver los lotes de todos; uno de
  -- planta con finca asignada no significa nada. La base lo exige.
  constraint perfil_proveedor_coherente check (
    (rol = 'proveedor' and proveedor_id is not null) or
    (rol <> 'proveedor' and proveedor_id is null)
  )
);

-- La invitación es lo que impide que cualquiera se declare supervisor.
-- Supervisión la deja escrita; la persona la consume al activarse. No hay
-- columna «usada»: el `unique` de perfiles.acceso ya hace que una
-- invitación solo pueda gastarse una vez.
create table if not exists invitaciones (
  acceso        text primary key,
  rol           text not null check (rol in ('supervisor','recepcion','produccion','proveedor')),
  proveedor_id  text,
  nombre        text not null,
  -- Segundo dato que la persona debe saber además del código: para un
  -- proveedor, su RUC. Sin esto, quien conozca el código de otro podría
  -- activar su cuenta antes que él (era la limitación §12.4).
  verificacion  text,
  creada_por    uuid,
  creada        timestamptz not null default now()
);

-- La solicitud es la puerta de la calle: una finca que todavía no existe
-- en el sistema pide entrar. No es una cuenta ni da acceso a nada; es un
-- papel en la bandeja de Supervisión, que decide.
--
-- Es la ÚNICA tabla donde alguien sin cuenta puede escribir, y por eso es
-- la que hay que mirar con más cuidado. Tres cosas la contienen:
--
--   · Solo INSERT. No hay política de lectura para `anon`, así que quien
--     escribe no puede leer lo que escribió, ni lo de nadie más. Sin esto,
--     la tabla sería una lista pública de los proveedores de la planta.
--   · El estado nace 'pendiente' y lo impone la política, no la aplicación:
--     nadie puede insertarse ya aprobado.
--   · El RUC es la clave primaria, así que insistir no llena la bandeja:
--     la segunda solicitud del mismo RUC pisa a la primera.
create table if not exists solicitudes (
  ruc           text primary key,
  nombre        text not null,
  contacto      text,
  mensaje       text,
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','aprobada','rechazada')),
  acceso        text,          -- el código que Supervisión le asigna al aprobar
  resuelta_por  uuid,
  resuelta      timestamptz,
  creada        timestamptz not null default now()
);

alter table perfiles      enable row level security;
alter table invitaciones  enable row level security;
alter table solicitudes   enable row level security;


-- ===================== 2. Preguntas que hace la base ======================

-- `security definer` para que la política pueda leer `perfiles` sin aplicarse
-- a sí misma, que es como se construye una recursión infinita. `search_path`
-- fijado: sin eso, una función definer es una puerta abierta a que alguien
-- anteponga un esquema suyo y secuestre lo que la función llama.
create or replace function acopia_rol()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select rol from perfiles where uid = auth.uid() and activo
$$;

create or replace function acopia_proveedor()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select proveedor_id from perfiles where uid = auth.uid() and activo
$$;

create or replace function acopia_es_planta()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(acopia_rol() in ('supervisor','recepcion','produccion'), false)
$$;

create or replace function acopia_es_supervisor()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(acopia_rol() = 'supervisor', false)
$$;

-- ¿Este lote es de la finca de quien pregunta? Hace falta para dejarle ver
-- la producción y el reporte de SUS lotes sin abrirle los de los demás.
create or replace function acopia_lote_es_mio(lote_id text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from documentos d
    where d.coleccion = 'lotes' and d.id = lote_id
      and d.datos->>'proveedorId' = acopia_proveedor()
  )
$$;


-- ¿Hay una invitación con este código y este dato de verificación, y sigue
-- sin gastarse? Devuelve sí o no, nunca el contenido: un desconocido no se
-- entera de a quién invitó la planta ni con qué RUC.
--
-- Hace falta que la pueda llamar alguien SIN cuenta. Sin esto, la única
-- manera de comprobar una invitación era crear antes la cuenta en Supabase,
-- y entonces quien se equivocaba al teclear su RUC se quedaba con una cuenta
-- a medias y sin poder volver a intentarlo nunca: el segundo intento moría
-- con «esa cuenta ya existe».
create or replace function acopia_invitacion_valida(p_acceso text, p_verificacion text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from invitaciones i
    where i.acceso = p_acceso
      and (i.verificacion is null or i.verificacion = p_verificacion)
      and not exists (select 1 from perfiles p where p.acceso = i.acceso)
  )
$$;
grant execute on function acopia_invitacion_valida(text, text) to anon, authenticated;


-- ========================= 3. Perfiles e invitaciones =====================

drop policy if exists perfil_leer on perfiles;
create policy perfil_leer on perfiles for select to authenticated
  using (uid = auth.uid() or acopia_es_planta());

-- La única manera de crearse un perfil: que exista una invitación que
-- coincida EXACTAMENTE en acceso, rol y finca. Copiar el rol de la
-- invitación no basta con pedirlo: hay que comprobarlo aquí, porque lo que
-- llega del navegador lo escribe el navegador.
drop policy if exists perfil_crear on perfiles;
create policy perfil_crear on perfiles for insert to authenticated
  with check (
    uid = auth.uid()
    and exists (
      select 1 from invitaciones i
      where i.acceso = perfiles.acceso
        and i.rol = perfiles.rol
        and i.nombre = perfiles.nombre
        and i.proveedor_id is not distinct from perfiles.proveedor_id
    )
  );

-- Nadie edita su propio perfil: subirse el rol sería trivial.
drop policy if exists perfil_editar on perfiles;
create policy perfil_editar on perfiles for update to authenticated
  using (acopia_es_supervisor()) with check (acopia_es_supervisor());

drop policy if exists perfil_borrar on perfiles;
create policy perfil_borrar on perfiles for delete to authenticated
  using (acopia_es_supervisor());

-- La invitación la lee quien va a usarla, que todavía no tiene perfil. Por
-- eso basta con estar autenticado; lo que la protege es que hay que saber
-- el código y el dato de verificación.
drop policy if exists invitacion_leer on invitaciones;
create policy invitacion_leer on invitaciones for select to authenticated using (true);

drop policy if exists invitacion_crear on invitaciones;
create policy invitacion_crear on invitaciones for insert to authenticated
  with check (acopia_es_supervisor());

drop policy if exists invitacion_editar on invitaciones;
create policy invitacion_editar on invitaciones for update to authenticated
  using (acopia_es_supervisor()) with check (acopia_es_supervisor());

drop policy if exists invitacion_borrar on invitaciones;
create policy invitacion_borrar on invitaciones for delete to authenticated
  using (acopia_es_supervisor());


-- ======================= 4. Los datos de la planta ========================

-- Fuera las políticas del piloto: dejaban entrar a cualquiera con la
-- dirección. A partir de aquí, `anon` no puede tocar nada.
drop policy if exists piloto_lectura   on documentos;
drop policy if exists piloto_escritura on documentos;
drop policy if exists piloto_edicion   on documentos;
drop policy if exists piloto_borrado   on documentos;

-- --- lectura ---
-- Planta lo ve todo. El proveedor ve SUS lotes, la producción de sus lotes,
-- su propia ficha y los catálogos que la pantalla necesita para dibujarse.
-- No ve lotes ajenos, ni la bitácora, ni la lista de usuarios.
drop policy if exists doc_leer on documentos;
create policy doc_leer on documentos for select to authenticated
  using (
    acopia_es_planta()
    or (
      acopia_rol() = 'proveedor' and (
        (coleccion = 'lotes'        and datos->>'proveedorId' = acopia_proveedor())
        or (coleccion = 'producciones' and acopia_lote_es_mio(datos->>'loteId'))
        or (coleccion = 'proveedores'  and id = acopia_proveedor())
        or (coleccion = 'sistema'      and id in ('config','meta'))
      )
    )
  );

-- --- alta ---
-- El proveedor solo puede crear lotes suyos y solo en estado «Anunciado»:
-- no puede darse por recibido ni por cerrado a sí mismo.
--
-- Y dentro de `sistema`, Recepción y Producción solo tocan la bitácora. La
-- primera versión les dejaba la colección entera «para que pudieran anotar»,
-- y con eso podían sobrescribir `sistema/config`: los pesos por gaveta, los
-- precios por kilo y los rendimientos de las tres líneas, que es de donde
-- sale cada cifra del documento. Lo encontró la prueba `rls`.
drop policy if exists doc_crear on documentos;
create policy doc_crear on documentos for insert to authenticated
  with check (
    (acopia_rol() = 'supervisor')
    or (acopia_rol() = 'recepcion'  and (coleccion = 'lotes' or (coleccion = 'sistema' and id = 'bitacora')))
    or (acopia_rol() = 'produccion' and (coleccion in ('lotes','producciones') or (coleccion = 'sistema' and id = 'bitacora')))
    or (
      acopia_rol() = 'proveedor'
      and coleccion = 'lotes'
      and datos->>'proveedorId' = acopia_proveedor()
      and datos->>'estado' = 'Anunciado'
    )
  );

-- --- edición ---
-- Mismas reglas, y además: el proveedor solo puede tocar un lote que siga
-- anunciado. En cuanto Recepción lo pesa, deja de ser suyo para escribir.
drop policy if exists doc_editar on documentos;
create policy doc_editar on documentos for update to authenticated
  using (
    (acopia_rol() = 'supervisor')
    or (acopia_rol() = 'recepcion'  and (coleccion = 'lotes' or (coleccion = 'sistema' and id = 'bitacora')))
    or (acopia_rol() = 'produccion' and (coleccion in ('lotes','producciones') or (coleccion = 'sistema' and id = 'bitacora')))
    or (
      acopia_rol() = 'proveedor'
      and coleccion = 'lotes'
      and datos->>'proveedorId' = acopia_proveedor()
      and datos->>'estado' = 'Anunciado'
    )
  )
  with check (
    (acopia_rol() = 'supervisor')
    or (acopia_rol() = 'recepcion'  and (coleccion = 'lotes' or (coleccion = 'sistema' and id = 'bitacora')))
    or (acopia_rol() = 'produccion' and (coleccion in ('lotes','producciones') or (coleccion = 'sistema' and id = 'bitacora')))
    or (
      acopia_rol() = 'proveedor'
      and coleccion = 'lotes'
      and datos->>'proveedorId' = acopia_proveedor()
      and datos->>'estado' = 'Anunciado'
    )
  );

-- --- borrado ---
-- Solo Supervisión. Es lo que usa «Empezar de cero» y el archivado mensual.
drop policy if exists doc_borrar on documentos;
create policy doc_borrar on documentos for delete to authenticated
  using (acopia_es_supervisor());

-- El resumen que la app consulta cada pocos segundos dejaría ver cuántos
-- lotes hay en total aunque no se puedan leer. Se le quita a `anon` y se
-- calcula respetando lo que cada quien puede ver.
revoke select on resumen_documentos from anon;
drop view if exists resumen_documentos;
create view resumen_documentos
  with (security_invoker = true) as
  select coleccion, count(*)::int as n, max(actualizado) as ultimo
  from documentos
  group by coleccion;
grant select on resumen_documentos to authenticated;

revoke all on documentos from anon;
grant select, insert, update, delete on documentos to authenticated;
grant select, insert, update, delete on perfiles to authenticated;
grant select, insert, update, delete on invitaciones to authenticated;

-- --- solicitudes de acceso ---
-- Quien no tiene cuenta puede DEJAR una solicitud y nada más. `anon` recibe
-- insert y ni una pizca de select: Postgres rechaza la lectura antes de
-- llegar a la política.
grant insert on solicitudes to anon;
grant select, insert, update, delete on solicitudes to authenticated;

drop policy if exists sol_crear_anon on solicitudes;
create policy sol_crear_anon on solicitudes for insert to anon
  with check (estado = 'pendiente' and resuelta_por is null and acceso is null);

-- Alguien con sesión iniciada también puede dejarla (un proveedor que pide
-- alta de una segunda finca), con la misma restricción.
drop policy if exists sol_crear_auth on solicitudes;
create policy sol_crear_auth on solicitudes for insert to authenticated
  with check (estado = 'pendiente' and resuelta_por is null and acceso is null);

-- Leerlas y resolverlas es cosa de Supervisión, y de nadie más. Recepción y
-- Producción tampoco: una solicitud lleva el RUC y el teléfono de una finca.
drop policy if exists sol_leer on solicitudes;
create policy sol_leer on solicitudes for select to authenticated
  using (acopia_es_supervisor());

drop policy if exists sol_resolver on solicitudes;
create policy sol_resolver on solicitudes for update to authenticated
  using (acopia_es_supervisor()) with check (acopia_es_supervisor());

drop policy if exists sol_borrar on solicitudes;
create policy sol_borrar on solicitudes for delete to authenticated
  using (acopia_es_supervisor());


-- ====================== 5. La primera supervisión =========================

-- Alguien tiene que poder entrar la primera vez, y no puede ser una
-- invitación creada por un supervisor que todavía no existe. Se deja
-- escrita aquí, que es el único sitio de confianza: este archivo lo ejecuta
-- quien es dueño del proyecto.
--
-- CAMBIA el nombre si quieres otro. Después de activarla, bórrala desde la
-- pantalla de Usuarios.
insert into invitaciones (acceso, rol, proveedor_id, nombre, verificacion)
values ('supervision', 'supervisor', null, 'Supervisión de planta', null)
on conflict (acceso) do nothing;
