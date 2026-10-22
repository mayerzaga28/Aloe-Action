# Evidencia y pendientes — 22 octubre 2026

## Ejecutado localmente

`npm test`: 23/23 pruebas aprobadas sobre PGlite (motor PostgreSQL local). Se aplicó la migración 001 a una base efímera. Las pruebas consultan filas de pedidos, inventario, movimientos y outbox, no solo mensajes de pantalla. Datos ficticios quedan únicamente en la base efímera de tests. `npm run build`, `git diff --check` y comprobación sintáctica JS aprobados. Instalación: 0 vulnerabilidades reportadas por npm al instalar.

Cubierto: catálogo inactivo/stock cero inicial, subtotal/envío calculado en servidor, CP sin tarifa bloqueado, cantidades inválidas y líneas duplicadas, datos incompletos, hash de cotización alterado, producto inactivo/agotado, idempotencia de reserva y cliente cambiado, dos intentos por última unidad, pago confirmado y webhooks duplicados, pago pendiente que pasa a pagado, expiración sin doble liberación, sesión/monto/moneda/modo/pedido incorrectos, eventos fuera de orden que no degradan venta, reembolso sin reposición automática, ajuste contra stock reservado, devolución física auditada, rol operations limitado, token de otro pedido rechazado, rutas de imagen seguras, recuperación idempotente de respuesta perdida de creación de checkout.

**Límites de estas pruebas**: la última unidad se prueba con dos promesas sobre conexiones serializadas de PGlite; falta repetir con dos conexiones reales de PostgreSQL alojado para demostrar bloqueo concurrente real. El estado de reembolso se coloca en la base por fixture: falta verificar el webhook de reembolso real en Stripe. Se prueban objetos de proveedor y un adaptador ficticio; NO se ha realizado un pago en Stripe ni se ha recibido un webhook remoto.

## No ejecutado aún / bloqueado por cuentas y decisiones

| Caso obligatorio | Estado |
|---|---|
| Compra aprobada, DB alojada y pago verificable en Stripe sandbox | Pendiente de cuentas y credenciales |
| Tarjeta rechazada / cancelación en Stripe | Pendiente |
| Pago pendiente que se resuelve | Máquina local probada; proveedor pendiente |
| Cliente cierra la ventana | Diseño independiente del retorno; prueba externa pendiente |
| Webhook firmado duplicado o retrasado | Idempotencia local probada; endpoint externo pendiente |
| Alterar precios/cantidades | Rechazado en pruebas locales |
| Última unidad, dos conexiones reales | Pendiente de DB alojada |
| Reserva vencida | Liberación local probada; cron/proveedor pendientes |
| Agotado y envío | Pruebas locales aprobadas, tarifa real no definida |
| Acceso no autorizado, RLS y sesión real | Permisos/token locales probados; Auth/RLS alojados pendientes |
| Correos recibidos / recuperación de acceso | Pendiente de dominio, proveedor y buzones |
| Contacto guardado, envío y guía end-to-end | Implementado, prueba conectada pendiente |
| Restauración de backup | Procedimiento escrito; ejercicio real pendiente |
| Plan comercial Vercel / alertas de gasto | Acceso al equipo denegado (403); pendiente |

No se han utilizado tarjetas reales ni cobrado dinero. El estado de lanzamiento permanece BLOQUEADO. La vista previa sin variables devuelve catálogo no conectado, no crea pedidos ni permite pagos; eso es un cierre seguro, no un checkout funcional validado.

## Secuencia de prueba conectada

1. Base de pruebas independiente, migraciones, rol limitado; usuario de equipo autorizado, SMTP y dominio verificado.
2. Crear existencias y regla postal exclusivamente ficticias en pruebas; aprobar políticas solo en esa base para el ensayo. Nunca importar ese stock a producción.
3. Variables Preview, APP_ORIGIN exacto, Stripe test, SALES_ENABLED=true solo para ensayo controlado. Confirmar que el endpoint remoto nunca acepta sk_live en Preview.
4. Stripe sandbox: tarjeta de prueba documentada por Stripe; aprobado/rechazado/autenticación/cancelación. Anotar order UUID, sesión, payment intent y evento SIN datos personales ni secretos.
5. Consultar en DB stock/reserved/movements/outbox y en Stripe monto/MXN/status. Reenviar el mismo evento, probar eventos retrasados, cerrar ventana y vencer sesión. Repetir última unidad con conexiones simultáneas independientes.
6. Verificar correos en bandejas autorizadas y eventos del proveedor; guía desde panel; contacto visible. Intentar acceso con usuario no autorizado y token de otro pedido.
7. Probar móvil y escritorio con los servicios conectados, luego restauración y rollback. Presentar evidencia al propietario y solicitar aprobación final. No lanzar con casos pendientes.
