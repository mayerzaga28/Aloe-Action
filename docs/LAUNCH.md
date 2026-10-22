# ALOE ACTION — tienda real, preparación de lanzamiento

Estado: **código en preparación, NO lista para recibir pagos reales**. No confundir pruebas locales con validación en Stripe/Supabase/Resend. No se ha creado ninguna cuenta ni contratado un servicio.

## Arquitectura y diagnóstico

La versión existente es HTML/CSS/JavaScript estático, carrito en sessionStorage, pago simulado y contacto no enviado. No hay Next.js, React ni base de datos. Se conservan los archivos visuales, fotografías y animaciones. El build elimina el pago simulado y sustituye exclusivamente los comportamientos de comercio/contacto y avisos incompatibles con una compra real.

Servidor: una Vercel Function Node.js 24, PostgreSQL administrado en Supabase y Supabase Auth para el equipo, Stripe Checkout alojado y Resend para correo. No hay un servidor permanente. PostgreSQL proporciona transacciones y bloqueos; Auth evita implementar contraseñas propias. No es necesario migrar el diseño a React.

El catálogo público de venta viene de `/api/commerce?action=catalog`. Las imágenes/editorial permanecen en HTML; precios y disponibilidad se cargan del servidor. Si falta la conexión, la tienda queda cerrada. No hay datos de prueba públicos. La migración contiene borradores 80 ml/$300 y 250 ml/$850, inactivos, cero existencias: **el propietario debe confirmar ambos importes y stock**.

## Cuentas y configuración pendiente del propietario

1. Plan del equipo Vercel `mayer11`: **Hobby**, verificado en el panel web el 22 de octubre (el conector respondió 403, pero la sesión web permitió leerlo). El uso comercial requiere Pro u otro plan apto. No activar ventas ni contratar Pro sin autorización.
2. Crear una cuenta gratuita Supabase y un proyecto exclusivo de PRUEBAS. Aceptación de términos por el propietario. No compartir contraseñas en el chat. Elegir una región cercana a Vercel. Desactivar registros públicos de Auth. Añadir la URL exacta `/admin` de la vista previa a la lista de redirecciones permitidas.
3. Ejecutar `migrations/001_commerce.sql` una sola vez con el propietario de la base de datos. Revisar y aplicar `002_runtime_role.sql` y `003_mail_delivery.sql`. Establecer una contraseña fuerte al rol `aloe_runtime` y habilitar LOGIN directamente en la consola segura. Usar su cadena de conexión del pool Supabase en DATABASE_URL (TLS con certificado verificado); no usar credenciales de propietario para la aplicación. No exponer el esquema `shop` en Data API. El rol de la aplicación no puede crear administradores ni aprobar políticas ni modificar reglas de envío.
4. Crear cuenta Stripe México y utilizar su sandbox/modo de prueba. No se requiere poner tarjetas reales. Copiar sk_test únicamente en la variable privada STRIPE_SECRET_KEY de Vercel Preview. Crear endpoint webhook `https://VISTA-PREVIA/api/commerce?action=webhook`. Configurar eventos checkout.session.completed, checkout.session.expired, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, payment_intent.payment_failed, payment_intent.canceled, charge.refunded y refund.updated. Guardar whsec en STRIPE_WEBHOOK_SECRET. El checkout habilita solo tarjetas; no OXXO/SPEI ni métodos de confirmación prolongada para este lanzamiento.
5. Crear Resend Free, verificar un dominio remitente propio mediante los DNS que indique Resend en Porkbun. No inventar registros. Configurar RESEND_API_KEY, MAIL_FROM, TEAM_EMAIL y SMTP personalizado para Supabase Auth. El remitente de prueba de Resend no sirve para enviar a todos los clientes. Verificar entrega a dos buzones reales autorizados, incluido enlace de acceso del administrador.
6. Crear un usuario de equipo desde Supabase Auth (no registro público). Registrar su UUID, correo en minúsculas y rol `owner` en shop.admins desde SQL Editor. Los colaboradores pueden tener rol `operations`; este rol no edita catálogo ni inventario. No existe endpoint público para otorgarse permisos. El panel `/admin` envía enlaces de acceso solo a usuarios ya autorizados; acceso y recuperación usan el mismo enlace seguro. La sesión se guarda en cookie HttpOnly/Secure/SameSite y se verifica con Auth y la lista de permisos en cada operación. Caduca aproximadamente en una hora.
7. Configurar todas las variables de `.env.example` directamente en Vercel Preview. Generar ORDER_TOKEN_SECRET, RATE_LIMIT_SECRET y CRON_SECRET aleatorios de al menos 32 caracteres en un gestor seguro. APP_ORIGIN debe coincidir exactamente con la URL usada (sin barra final). No reutilizar base de datos, claves, dominio de callback ni secretos entre prueba y producción. PAYMENT_MODE=test; SALES_ENABLED=false; LIVE_APPROVED=false; CONTACT_ENABLED=false.

## Decisiones comerciales pendientes

El propietario indicó que no tiene todavía cuentas, correos/políticas/datos comerciales y pidió posponer envíos. Por ello no se habilitan cobros. Faltan: confirmación de precios e impuestos incluidos, existencias físicas, SKU definitivo, peso y medidas si aplica, identidad del vendedor, domicilio y canal de atención, dominio remitente, privacidad y condiciones de compra/devolución aprobadas.

Envíos: cobertura por códigos postales exactos, tarifa en centavos y texto de plazo aprobado en shop.shipping. Cero tarifas iniciales. Cada CP debe coincidir con UNA regla; cero o más de una bloquea compra. No existe envío gratis implícito. Para pruebas únicamente, insertar una regla ficticia en la base de PRUEBAS, claramente identificada y jamás copiada a producción. Las páginas `/terminos`, `/envios`, `/devoluciones` y `/privacidad` son avisos pendientes, **no políticas legales definitivas**. Requieren validación comercial/legal de México antes del lanzamiento.

## Inventario y pagos

- Existencia física, reservada y disponible se registran por presentación. Bloqueo de filas en orden estable y transacción para reservar; el navegador nunca decide el importe.
- Carrito no reserva. Reserva al crear pedido, sesión Stripe de 35 minutos. Solo se libera al consultar Stripe y confirmar sesión expirada/no pagada. Cerrar el navegador no equivale a cancelar. Los pagos pendientes completados siguen reservados hasta resolución; no se liberan a ciegas por reloj.
- Se persisten parámetros exactos de Stripe antes de invocarlo y se usa una clave idempotente por pedido. Un timeout no crea otro pedido ni reserva al reintentar la misma compra. Reconciliación recupera sesiones con respuesta perdida. Si la incertidumbre supera 20 horas, requiere revisión manual; no se reintenta creación fuera de la ventana de idempotencia.
- Webhook firmado, consulta al proveedor, verifica pedido/sesión/monto/MXN/modo; venta y eventos se registran en transacción. Eventos repetidos no duplican venta/correos. El pago no depende de que el comprador vuelva. Un pago tardío tras liberación se marca para revisión, sin vender unidades inexistentes.
- Reembolsos se ejecutan manualmente en Stripe por un usuario autorizado y el webhook actualiza su estado; no hay botón de reembolso en este panel. El reembolso no repone unidades. La devolución física se registra como ajuste explícito con motivo y pedido relacionado.
- Se necesita invocar el trabajador cada 5 minutos en producción: GET `/api/commerce?action=jobs` con Authorization Bearer CRON_SECRET. Tras confirmar Pro, configurar Vercel Cron `*/5 * * * *`. No se incluye cron activo en esta versión para no asumir plan/costos. Panel tiene revisión manual de pagos y correos como contingencia, no sustituto de automatización antes de lanzar.

## Correo, contacto y protección

Outbox transaccional y clave idempotente Resend. Reintentos con lease compartido entre instancias. Tras 20 h de entrega incierta se detiene y requiere verificar en Resend para evitar duplicados fuera de su ventana de 24 h. “Sent” significa aceptado por API, no bandeja de entrada. Fallos quedan visibles; rebotes/recepción requieren revisión del proveedor hasta integrar/verificar eventos de entrega. El panel permite reintentar trabajos dentro de la ventana segura. No pulsar reenvíos manuales antes de consultar el estado del proveedor.

Contacto guarda el mensaje en DB y encola aviso al equipo; solo responde éxito tras commit. Está deshabilitado hasta aprobar privacidad. Límite de solicitudes en DB por hash de IP y acción; no se registra IP cruda. Entradas validadas, SQL parametrizado, control de origen, cookies seguras y permisos en servidor. No se aceptan cargas de archivos: fotos mediante rutas locales de archivos revisados y subidos por GitHub. Se rechazan SVG/HTML/URLs remotas. Esto evita abrir un servicio de uploads sin protección.

El enlace privado del pedido lleva un token HMAC de 256 bits en el fragmento, no un número adivinable. Se envía por POST y se quita de la barra; no devuelve nombre/dirección/correo. No compartir esos enlaces. No se almacenan tarjetas. Datos personales no se imprimen en logs. Exportaciones CSV neutralizan prefijos de fórmulas; proteger los archivos descargados. Límite de 100 pedidos por búsqueda en el panel; ajustar filtro para exportar otros resultados.

## Operación diaria

1. Entrar en `/admin` mediante correo autorizado. Crear/editar presentaciones; importes en CENTAVOS. El campo producto_id agrupa presentaciones del mismo producto; conservarlo al crear otra presentación. Activar producto y presentación solo tras confirmar contenido.
2. Registrar entrada inicial y ajustes con motivo. No editar conteos en SQL en operación normal. Revisar alertas configurables por presentación.
3. Filtrar pedidos; comprobar pago separado de preparación. Preparar únicamente pedidos pagados. Registrar paquetería y guía al marcar enviado; se encola correo del cliente. Marcar entregado cuando haya evidencia.
4. Revisar mensajes, fallos de correo, pedidos pendientes y movimientos. El panel no inventa un enlace de seguimiento de una paquetería; muestra su nombre y guía.

## Backup, recuperación y publicación

Punto recuperable visual: tag `backup/pre-commerce-2026-10-22`, commit 7ce89dc. Rama de trabajo `commerce-launch`, no production. Los archivos originales visuales permanecen y el build deriva el público; no ejecutar el antiguo generador externo encima de esta rama.

Base de datos: en Free no asumir backups automáticos recuperables. Antes de migración y diariamente en operación, realizar `pg_dump` cifrado del esquema shop con una cuenta de backup de solo lectura. Guardar fuera de Git y del directorio public, en almacenamiento privado con acceso limitado. Retención propuesta a aprobar: 7 copias diarias + 4 semanales. Probar `pg_restore` en una base vacía aislada, comprobar conteos, totales e inventario antes de considerar el backup útil. Exportar la relación de administradores y documentar que Supabase Auth se recupera por su propio procedimiento. No publicar dumps con PII. Esto es un procedimiento, no un backup automático ya contratado/configurado.

Rollback del código: desactivar SALES_ENABLED, volver al despliegue anterior o revertir commits en la rama. No borrar pedidos ni revertir stock a un snapshot viejo mientras haya pagos posteriores: reconciliar Stripe primero. Migraciones aditivas; no deshacer 001 eliminando datos. Probar restauración real antes de lanzamiento.

Producción requiere nueva DB, Stripe live, webhook live, dominio/HTTPS verificado, correos recibidos, plan Vercel comercial autorizado, alertas/cron, privacidad/envíos/stock confirmados y aprobación final del propietario. Crear un build de producción sin asignar dominio, probarlo con el alcance acordado y promoverlo únicamente con aprobación. No activar LIVE_APPROVED ni SALES_ENABLED por anticipado. Configurar alertas de gasto Vercel y límites de proveedores; ninguna suscripción se activa desde este código.

## Costos verificados 22 octubre 2026

- Vercel Hobby: uso personal no comercial. Pro anunciado $20 USD/mes y consumo adicional sujeto a límites/crédito, no promesa de costo fijo ilimitado. Esta cuenta usa Hobby (verificado en el panel). https://vercel.com/docs/plans/hobby · https://vercel.com/pricing
- Supabase Free: $0, 500 MB DB, 1 GB archivos, 5 GB salida, 50,000 usuarios activos, máximo 2 proyectos activos; pausa tras una semana de inactividad. No ofrece la misma continuidad/backups de Pro. Pro desde $25 USD/mes. Sus términos permiten propósitos de negocio y no muestran una exclusión de uso comercial del plan Free como Vercel; sujeto a términos/uso permitido vigentes. https://supabase.com/pricing · https://supabase.com/terms
- Resend Free: 3,000 correos/mes y máximo 100/día; los correos al cliente, equipo y acceso consumen cuota. Uso transaccional comercial sujeto a términos/consentimientos; no encontré restricción “solo personal”. No activar facturación ni excedentes sin autorización. https://resend.com/pricing · https://resend.com/blog/new-free-tier · https://resend.com/legal/terms-of-service
- Stripe México estándar: 3.6% + $3 MXN por tarjeta nacional exitosa; adicionales para tarjetas internacionales/conversión y tratamiento fiscal según cuenta. No incluye estos costos en “gratis”. Checkout incluido con Payments estándar. Confirmar condiciones de la cuenta al crearla. https://stripe.com/mx/pricing
- Dominio existente: renovación Porkbun separada, correo de buzón comercial/paquetería/contracargos y costos fiscales no incluidos. No se ha contratado nada.

## Criterio de listo

No basta con pruebas de código. Ver `TESTS.md`. Falta verificar DB alojada y concurrencia real, sandbox Stripe (aprobado/rechazado/cancelado/pendiente/timeout/webhooks), correos recibidos, acceso real del equipo, cron/alertas y recuperación. Hasta entonces, ventas desactivadas.

## Protección de la vista previa

Vercel Authentication protege este preview. El propietario puede verlo con su sesión de Vercel; no es un enlace abierto al público. No se desactivó la protección. Stripe no podrá entregar webhooks a un endpoint protegido por esa capa sin una configuración adicional autorizada: antes del ensayo conectado, acordar una excepción limitada al endpoint firmado o un entorno de pruebas dedicado y accesible. No quitar toda la protección del proyecto para resolverlo. La autenticación del panel de ALOE ACTION es una capa separada y no debe retirarse.

El trabajador consulta también el último evento de entrega de Resend y lo guarda en `delivery_status` (aceptado, entregado, rebotado, etc.). No está verificado contra una cuenta real. Incluso `delivered` confirma aceptación del servidor destinatario, no lectura ni bandeja principal; comprobar recepción manual antes del lanzamiento. La revisión periódica no sustituye el ensayo de entrega.
