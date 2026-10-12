-- Dos fincas, una supervisión, una recepción, una producción, y un
-- desconocido con cuenta pero sin perfil.
truncate documentos, perfiles, invitaciones;
delete from auth.users;

insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','sup@x'),
 ('00000000-0000-0000-0000-00000000000b','rec@x'),
 ('00000000-0000-0000-0000-00000000000c','pro@x'),
 ('00000000-0000-0000-0000-000000000001','marta@x'),
 ('00000000-0000-0000-0000-000000000002','luis@x'),
 ('00000000-0000-0000-0000-0000000000ff','intruso@x');

insert into perfiles (uid, acceso, rol, proveedor_id, nombre) values
 ('00000000-0000-0000-0000-00000000000a','aquiroz','supervisor',null,'Andrea Quiroz'),
 ('00000000-0000-0000-0000-00000000000b','dandrade','recepcion',null,'Diego Andrade'),
 ('00000000-0000-0000-0000-00000000000c','cmendoza','produccion',null,'Carlos Mendoza'),
 ('00000000-0000-0000-0000-000000000001','PRV-001','proveedor','pv_1','Marta Cedeño'),
 ('00000000-0000-0000-0000-000000000002','PRV-002','proveedor','pv_2','Luis Vera');

insert into invitaciones (acceso, rol, proveedor_id, nombre, verificacion) values
 ('PRV-003','proveedor','pv_3','Finca Nueva','1790000003001');

insert into documentos (coleccion, id, datos) values
 ('lotes','lt_1','{"proveedorId":"pv_1","estado":"Anunciado","codigoLote":"PIT-001"}'),
 ('lotes','lt_2','{"proveedorId":"pv_1","estado":"Recibido","codigoLote":"PIT-002"}'),
 ('lotes','lt_9','{"proveedorId":"pv_2","estado":"Anunciado","codigoLote":"TOM-009"}'),
 ('producciones','pr_1','{"loteId":"lt_2","exportables":100}'),
 ('producciones','pr_9','{"loteId":"lt_9","exportables":50}'),
 ('proveedores','pv_1','{"nombre":"Finca La Esperanza"}'),
 ('proveedores','pv_2','{"nombre":"Predio Santa Rosa"}'),
 ('usuarios','us_1','{"nombre":"Marta","claveHash":"NO-DEBE-VERSE"}'),
 ('sistema','config','{"lineas":[1,2,3]}'),
 ('sistema','bitacora','{"entradas":["secreto de planta"]}'),
 ('sistema','meta','{"esquema":9}');
