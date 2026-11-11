-- Migración v3: restricción UNIQUE en el consecutivo de certificados.
-- Ejecutar UNA sola vez sobre la base portal_acegrasco ya existente
-- (phpMyAdmin > base portal_acegrasco > pestaña SQL).
--
-- PASO 1. Verifica que NO haya consecutivos repetidos. Debe devolver 0 filas:
--   SELECT consecutivo, COUNT(*) AS veces FROM certificados GROUP BY consecutivo HAVING COUNT(*) > 1;
-- Si devuelve filas, corrige esos números antes de continuar, por ejemplo:
--   UPDATE certificados SET consecutivo = (SELECT m FROM (SELECT MAX(consecutivo)+1 AS m FROM certificados) t)
--   WHERE id_certificado = <id del certificado repetido>;
--
-- PASO 2. Crea la restricción:

USE portal_acegrasco;

ALTER TABLE certificados
  ADD CONSTRAINT uq_certificados_consecutivo UNIQUE (consecutivo);

-- Las contraseñas en texto plano NO se cambian aquí: se convierten a hash con
--   cd Backend && npm run hash-passwords
