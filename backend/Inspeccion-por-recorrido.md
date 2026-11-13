# Inspección por recorrido

Código completo vigente: `Codigo-Maestro-Inspeccion-Recorrido.txt`.

Una inspección con cuatro evidencias confirmadas respalda servicios consecutivos del mismo chofer, vehículo y día argentino. Cada viaje conserva sus propios horarios y kilómetros; `ID_RECORRIDO` e `ID_INSPECCION` vinculan la inspección original sin copiar fotos. Finalizar servicio mantiene la inspección abierta. Finalizar recorrido, cambiar de unidad o cambiar de jornada exige otra inspección.

Preparación aditiva: ejecutar `prepararInspeccionesPorRecorrido`. Agrega `RECORRIDOS_CHOFER` y dos columnas al final de `VIAJES`. No modifica filas históricas ni contraseñas. Ejecutar `diagnosticarInspeccionesPorRecorrido` y actualizar la implementación existente manteniendo su URL. No ejecutar `configurarBackend`.

Los clientes anteriores siguen enviando cuatro fotos; el backend evita copiarlas cuando hay inspección vigente. La app nueva consulta la vigencia al abrir la preparación de salida. Si la consulta falla, mantiene el requisito de fotos. Los cierres en segundo plano conservan el indicador `finalizarRecorrido` y son idempotentes.

Pruebas: `node --test tests/*.test.cjs` desde la raíz del repositorio.
