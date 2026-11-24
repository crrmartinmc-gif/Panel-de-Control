# Inspección por recorrido

Código completo vigente: `Codigo-Maestro-Actualizacion-Panel.txt`.

Logística Ambiental y Reserva Santa Catalina envían `fotosPorViaje: true`. Cada salida registra cuatro fotos y una inspección propias. Los servicios de la jornada pueden compartir el `ID_RECORRIDO`. Secretaría conserva la inspección compartida del mismo chofer, vehículo y jornada.

Preparación aditiva: ejecutar `prepararInspeccionesPorRecorrido`. Agrega `RECORRIDOS_CHOFER` y dos columnas al final de `VIAJES`. No modifica filas históricas ni contraseñas. Ejecutar `diagnosticarInspeccionesPorRecorrido` y actualizar la implementación existente manteniendo su URL. No ejecutar `configurarBackend`.

Publicar primero la versión del Backend Maestro en la implementación existente de Apps Script y luego la app de Choferes. Las solicitudes anteriores siguen siendo compatibles durante la actualización. La respuesta `fotosViajeCompletas` indica si el viaje tiene sus cuatro evidencias propias.

Pruebas: `node --test tests/*.test.cjs` desde la raíz del repositorio.

Actualización del panel: las fechas dd/MM/yyyy del backend se normalizan en el cliente; Actualizar fuerza una instantánea y los cursores se recuperan tras limpiezas. La reutilización de asignaciones distingue jornadas y la app permite completar fotos de un viaje iniciado en el panel. `repararIniciosServiciosHoy` completa únicamente horas vacías con horas reales del viaje del día.
