/* =========================================================================
   nube-config.js — Dónde vive el almacén compartido

   Este es el ÚNICO archivo que hay que tocar para conectar la app a su
   propia base de datos. Mientras los dos valores estén vacíos, la app
   funciona igual que siempre: usa el almacén del artefacto de Claude si lo
   encuentra, y si no, guarda solo en el equipo.

   Cómo se llenan (una sola vez, ~5 minutos):

     1. Entra a https://supabase.com y crea una cuenta gratuita.
     2. «New project». Ponle un nombre y una contraseña de base de datos
        —esa contraseña NO va aquí, guárdala aparte— y elige la región más
        cercana (South America (São Paulo) para Ecuador).
     3. Cuando termine de crearse, ve a «SQL Editor», pega el contenido de
        `tools/supabase.sql` y pulsa «Run». Eso crea la tabla.
     4. Ve a «Project Settings» → «API» y copia:
          · «Project URL»          → aquí abajo, en `url`
          · «anon public» (API Key) → aquí abajo, en `clave`
     5. Vuelve a empaquetar (`node tools/empaquetar.js`) y publica.

   Sobre la clave: la `anon public` de Supabase está pensada para vivir
   dentro del navegador, a la vista. No es un secreto y no da acceso de
   administrador. Lo que SÍ hay que entender es que, con la configuración
   básica de `supabase.sql`, cualquiera que tenga la dirección de la app
   puede leer y escribir en el almacén. Para la demostración y el piloto es
   aceptable; para los datos reales de la planta bajo acuerdo de
   confidencialidad, NO. El README explica el siguiente paso (§11).
   ========================================================================= */

/* Si algo ya puso los valores antes —un despliegue que los inyecta, o una
   prueba automatizada— se respetan. Así este archivo nunca pisa una
   configuración buena con dos cadenas vacías. */
window.ACOPIA_NUBE = window.ACOPIA_NUBE || {
  url: "https://pfnioopjtybjkbuxwxao.supabase.co",
  clave: ""
};
