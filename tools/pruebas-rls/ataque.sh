#!/bin/bash
# Ataca las políticas desde fuera, como lo haría alguien con la consola del
# navegador abierta: con la sesión de otra persona y pidiendo lo que no le
# toca. Cada caso corre en su propia transacción y se deshace.
PSQL="psql -h /var/tmp -p 5433 -U postgres -t -A -q -v ON_ERROR_STOP=1"
SUP=00000000-0000-0000-0000-00000000000a
REC=00000000-0000-0000-0000-00000000000b
PRO=00000000-0000-0000-0000-00000000000c
M=00000000-0000-0000-0000-000000000001
L=00000000-0000-0000-0000-000000000002
X=00000000-0000-0000-0000-0000000000ff
NUEVO=00000000-0000-0000-0000-0000000000e1
fallos=0

como() {  # como <uid|anon> <sql>
  local uid="$1"; shift
  if [ "$uid" = "anon" ]; then
    $PSQL <<EOF 2>&1
begin; set local role anon; $* ; rollback;
EOF
  else
    $PSQL <<EOF 2>&1
begin; set local role authenticated; set local request.jwt.claim.sub = '$uid'; $* ; rollback;
EOF
  fi
}

cuenta() {  # cuenta <nombre> <uid> <sql-select> <esperado>
  local n="$1" uid="$2" sql="$3" esp="$4"
  local r; r=$(como "$uid" "$sql" | tail -1 | tr -d ' ')
  if [ "$r" = "$esp" ]; then echo "  ok   $n"; else echo "  MAL  $n → '$r', se esperaba '$esp'"; fallos=$((fallos+1)); fi
}

denegado() {  # denegado <nombre> <uid> <sql>
  local n="$1" uid="$2" sql="$3"
  local salida; salida=$(como "$uid" "$sql")
  # Postgres rechaza de dos maneras: con error (INSERT contra WITH CHECK) o
  # en silencio, afectando a cero filas (UPDATE/DELETE contra USING). Las
  # dos son un rechazo; la segunda es la que se olvida al escribir pruebas.
  if echo "$salida" | grep -qi "row-level security\|permission denied\|violates"; then
    echo "  ok   $n"
  else
    echo "  MAL  $n → NO fue rechazado: $(echo "$salida" | tr '\n' ' ' | cut -c1-90)"; fallos=$((fallos+1))
  fi
}

sinefecto() {  # sinefecto <nombre> <uid> <update|delete>  → 0 filas tocadas
  local n="$1" uid="$2" sql="$3"
  local r; r=$(como "$uid" "with t as ($sql returning 1) select count(*) from t;" | tail -1 | tr -d ' ')
  if [ "$r" = "0" ]; then echo "  ok   $n"; else echo "  MAL  $n → tocó $r fila(s)"; fallos=$((fallos+1)); fi
}

permitido() {  # permitido <nombre> <uid> <sql>
  local n="$1" uid="$2" sql="$3"
  local salida; salida=$(como "$uid" "$sql")
  if echo "$salida" | grep -qi "row-level security\|permission denied\|violates\|ERROR"; then
    echo "  MAL  $n → fue rechazado: $(echo "$salida" | tr '\n' ' ' | cut -c1-90)"; fallos=$((fallos+1))
  else
    echo "  ok   $n"
  fi
}

echo ""
echo "[1] Sin cuenta no se entra"
denegado "anónimo no lee ni un documento"     anon "select count(*) from documentos;"
denegado "anónimo no lee perfiles"             anon "select count(*) from perfiles;"
denegado "anónimo no escribe"                  anon "insert into documentos(coleccion,id,datos) values('lotes','x','{}');"

echo ""
echo "[2] Una cuenta sin perfil no vale de nada"
cuenta "autenticado sin perfil no ve documentos" $X "select count(*) from documentos;" 0
cuenta "autenticado sin perfil no ve perfiles"   $X "select count(*) from perfiles;" 0
denegado "autenticado sin perfil no escribe"     $X "insert into documentos(coleccion,id,datos) values('lotes','x','{}');"

echo ""
echo "[3] Nadie se inventa su propio rol"
denegado "sin invitación no hay perfil" $X \
  "insert into perfiles(uid,acceso,rol,nombre) values('$X','intruso','supervisor','Intruso');"
denegado "con invitación de proveedor no se es supervisor" $NUEVO \
  "insert into perfiles(uid,acceso,rol,nombre) values('$NUEVO','PRV-003','supervisor','Finca Nueva');"
denegado "ni cambiando la finca de la invitación" $NUEVO \
  "insert into perfiles(uid,acceso,rol,proveedor_id,nombre) values('$NUEVO','PRV-003','proveedor','pv_1','Finca Nueva');"
$PSQL -c "insert into auth.users(id,email) values('$NUEVO','n@x') on conflict do nothing;" >/dev/null
permitido "con la invitación exacta, sí" $NUEVO \
  "insert into perfiles(uid,acceso,rol,proveedor_id,nombre) values('$NUEVO','PRV-003','proveedor','pv_3','Finca Nueva');"
denegado "la invitación no sirve dos veces" $NUEVO \
  "insert into perfiles(uid,acceso,rol,proveedor_id,nombre) values('$NUEVO','PRV-001','proveedor','pv_1','Marta Cedeño');"
sinefecto "nadie se sube el rol a sí mismo" $M \
  "update perfiles set rol='supervisor' where uid='$M'"
sinefecto "ni se cambia de finca"          $M \
  "update perfiles set proveedor_id='pv_2' where uid='$M'"
denegado "un proveedor no crea invitaciones" $M \
  "insert into invitaciones(acceso,rol,nombre) values('colado','supervisor','Colado');"

echo ""
echo "[4] Un proveedor solo ve lo suyo"
cuenta "ve sus 2 lotes y ninguno más"       $M "select count(*) from documentos where coleccion='lotes';" 2
cuenta "pedir el lote ajeno por id da cero" $M "select count(*) from documentos where coleccion='lotes' and id='lt_9';" 0
cuenta "ve la producción de sus lotes"      $M "select count(*) from documentos where coleccion='producciones';" 1
cuenta "no ve la lista de usuarios"         $M "select count(*) from documentos where coleccion='usuarios';" 0
cuenta "no ve la bitácora de planta"        $M "select count(*) from documentos where coleccion='sistema' and id='bitacora';" 0
cuenta "sí ve los catálogos"                $M "select count(*) from documentos where coleccion='sistema' and id='config';" 1
cuenta "ve su ficha y no la del vecino"     $M "select count(*) from documentos where coleccion='proveedores';" 1
cuenta "el otro proveedor ve lo suyo"       $L "select count(*) from documentos where coleccion='lotes';" 1

echo ""
echo "[5] Un proveedor no escribe lo que no es suyo"
denegado "no anuncia a nombre de otra finca" $M \
  "insert into documentos(coleccion,id,datos) values('lotes','nuevo','{\"proveedorId\":\"pv_2\",\"estado\":\"Anunciado\"}');"
denegado "no se da por recibido a sí mismo"  $M \
  "insert into documentos(coleccion,id,datos) values('lotes','nuevo','{\"proveedorId\":\"pv_1\",\"estado\":\"Recibido\"}');"
permitido "sí anuncia un lote suyo"          $M \
  "insert into documentos(coleccion,id,datos) values('lotes','nuevo','{\"proveedorId\":\"pv_1\",\"estado\":\"Anunciado\"}');"
cuenta "no puede editar un lote ya pesado"   $M \
  "with u as (update documentos set datos=datos||'{\"kgRecibidos\":9999}' where coleccion='lotes' and id='lt_2' returning 1) select count(*) from u;" 0
cuenta "sí puede corregir el suyo anunciado" $M \
  "with u as (update documentos set datos=datos||'{\"gavetasAnunciadas\":50}' where coleccion='lotes' and id='lt_1' returning 1) select count(*) from u;" 1
sinefecto "no toca los catálogos"            $M \
  "update documentos set datos='{}' where coleccion='sistema' and id='config'"
cuenta "no borra nada"                       $M \
  "with d as (delete from documentos where coleccion='lotes' and id='lt_1' returning 1) select count(*) from d;" 0

echo ""
echo "[6] Cada rol de planta escribe lo suyo"
cuenta "planta lo ve todo"                  $REC "select count(*) from documentos;" 11
denegado "recepción no escribe producción"  $REC \
  "insert into documentos(coleccion,id,datos) values('producciones','x','{}');"
permitido "recepción sí pesa lotes"         $REC \
  "update documentos set datos=datos||'{\"estado\":\"Recibido\"}' where coleccion='lotes' and id='lt_1';"
permitido "producción sí registra mermas"   $PRO \
  "insert into documentos(coleccion,id,datos) values('producciones','x','{\"loteId\":\"lt_1\"}');"
sinefecto "producción no edita catálogos"   $PRO \
  "update documentos set datos='{}' where coleccion='sistema' and id='config'"
cuenta "recepción no borra"                 $REC \
  "with d as (delete from documentos where coleccion='lotes' and id='lt_1' returning 1) select count(*) from d;" 0
permitido "supervisión edita catálogos"     $SUP \
  "update documentos set datos='{}' where coleccion='sistema' and id='config';"
cuenta "supervisión sí borra"               $SUP \
  "with d as (delete from documentos where coleccion='lotes' and id='lt_1' returning 1) select count(*) from d;" 1

sinefecto "recepción tampoco edita catálogos" $REC \
  "update documentos set datos='{}' where coleccion='sistema' and id='config'"
denegado "recepción no crea documentos de sistema que no sean la bitácora" $REC \
  "insert into documentos(coleccion,id,datos) values('sistema','meta','{}');"
permitido "pero sí anota en la bitácora"      $REC \
  "update documentos set datos='{\"entradas\":[]}' where coleccion='sistema' and id='bitacora';"

echo ""
echo "[7] El resumen no filtra lo que las filas esconden"
cuenta "planta cuenta los 3 lotes"    $REC "select n from resumen_documentos where coleccion='lotes';" 3
cuenta "el proveedor cuenta 2"        $M   "select n from resumen_documentos where coleccion='lotes';" 2
cuenta "y no ve la fila de usuarios"  $M   "select count(*) from resumen_documentos where coleccion='usuarios';" 0

echo ""
echo "[8] Desactivar a alguien le cierra la puerta"
$PSQL -c "update perfiles set activo=false where uid='$M';" >/dev/null
cuenta "un perfil desactivado no ve nada"   $M "select count(*) from documentos;" 0
cuenta "ni puede escribir"                  $M "select count(*) from resumen_documentos;" 0
$PSQL -c "update perfiles set activo=true where uid='$M';" >/dev/null

echo ""
if [ $fallos -eq 0 ]; then echo "Todo en orden."; else echo "FALLOS: $fallos"; fi
exit $fallos
