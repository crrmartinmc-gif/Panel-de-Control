# Actualizar el Backend Maestro sin reemplazar los otros módulos

## Opción recomendada: archivo principal completo

`Codigo-Completo-Backend-Maestro.txt` contiene el código completo compartido por el propietario, con las cinco funciones de sincronización reemplazadas y los nuevos ayudantes incorporados una sola vez.

1. Guardar una copia privada del código actual del proyecto del Backend Maestro.
2. Reemplazar **todo el archivo principal** por este TXT completo. Conservar los otros archivos y todas las propiedades privadas del proyecto. No pegar además el TXT parcial de más abajo.
3. Guardar y ejecutar `diagnosticoSincronizacionDiaVerde`. Debe indicar `ok:true`, `syncVersion:2` y `evidenciasDisponibles:true`.
4. Implementar → Administrar implementaciones → editar la actual → Nueva versión, manteniendo la misma URL `/exec` y permisos.

No es necesario ejecutar `configurarBackend`, volver a importar usuarios ni ejecutar pruebas que creen viajes, GPS o evidencias. Se conservan los módulos de flota, choferes, servicios, reportes, notificaciones y autenticación del código recibido. La contraseña fija que tenía el ayudante opcional `TEST_AUTH` se reemplazó por una propiedad privada `AUTH_TEST_PASSWORD`; esto solo afecta a esa prueba opcional, no a las cuentas reales.

## Alternativa: reemplazos individuales

Este TXT es un conjunto de reemplazos para el Apps Script del **Backend Maestro del Panel**. No reemplaza el proyecto completo. No pertenece al Apps Script de evidencias de Día Verde.

1. Guardar una copia privada del código actual del proyecto del Backend Maestro.
2. Buscar y eliminar **solamente las definiciones completas** de estas cinco funciones actuales:

   - `obtenerMapaDiaVerde_`
   - `aplicarCorreccionesReclamosDiaVerde_`
   - `obtenerReclamosDiaVerde_`
   - `guardarCorreccionReclamo_`
   - `eliminarCorreccionReclamo_`

3. Pegar todo `Sincronizacion-Dia-Verde.txt` al final del código. Cada función de esa lista debe existir una sola vez. Conservar las demás funciones, constantes y los `doGet`/`doPost` originales.
4. Guardar y ejecutar `diagnosticoSincronizacionDiaVerde`. Es una consulta: no crea GPS de prueba, evidencias ni envía avisos. El resultado debe tener `ok:true`, `syncVersion:2` y `evidenciasDisponibles:true`. No imprimir ni compartir ubicaciones de personas para comprobarlo.
5. Implementar → Administrar implementaciones → editar la actual → Nueva versión. Conservar la misma URL `/exec`, permisos y modo de ejecución actuales.

Por defecto se conservan los IDs ya configurados en `MAPA_DIA_VERDE`. Solo si se necesita otra planilla histórica, se puede definir la propiedad privada `DIA_VERDE_HISTORICO_ID`; debe coincidir con `ID_HOJA_DE_DISPERSION` del proyecto de Día Verde.

Los cambios preservan los campos anteriores y agregan la identidad de puntos/recorridos, la foto, el CGM y los metadatos de las evidencias. Las correcciones de ubicación no se reutilizan entre localidades solo porque coincidan calle y altura. Las evidencias se consultan directamente en la planilla histórica compartida para evitar una llamada intermedia al servidor de Día Verde.

El frontend del Panel sigue actualizando GPS cada 15 segundos y consulta reclamos/evidencias cada 30 segundos. No es una transmisión instantánea: muestra cuándo se confirmó una consulta y distingue posiciones antiguas o recorridos finalizados.

## Verificación local

`node --test tests/*.test.cjs`

Se probaron posiciones separadas para usuarios con el mismo nombre, precisión y coordenadas ausentes, segmentación por recorrido, preservación de foto/ID y correcciones limitadas al CGM correspondiente.
