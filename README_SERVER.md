Servidor para guardar imágenes en ImgProductos

Requisitos:
- Node.js (>=14)

Instalación y ejecución (Windows PowerShell):

```powershell
# desde la carpeta del proyecto
npm install
npm start
```

El servidor se ejecutará en http://localhost:3000 y servirá los archivos estáticos del proyecto.

Endpoints relevantes:
- POST /upload-image  (multipart/form-data, campo 'image')
  - Respuesta: { imageUrl: '/ImgProductos/<archivo>' }
- POST /delete-image  (JSON { imageUrl }) -> borra archivo en servidor

Autenticación y seguridad
- El servidor ahora usa sesiones (cookies) para autenticar al administrador.
- Endpoints sensibles (/upload-image, /delete-image, /api/change-credentials) requieren que el usuario esté autenticado en sesión.
- Variables de entorno importantes:
  - `SESSION_SECRET`: secreto usado por express-session (cámbialo en producción).

Ejemplo (PowerShell) para arrancar con una clave de sesión segura:

```powershell
$env:SESSION_SECRET = 'mi_secreto_seguro_aqui'; npm install; npm start
```

Autenticación en la app
- Para iniciar sesión la app usa `POST /api/login` (campo JSON `{ user, pass }`) y el servidor crea una sesión.
- Para cerrar sesión la app usa `POST /api/logout`.
- Para comprobar la sesión la app usa `GET /api/session`.

Gestión de credenciales
- Las credenciales están guardadas en `creds.json`. Puedes cambiar las credenciales desde el panel admin (formulario) que llama a `POST /api/change-credentials`.

Eliminar imágenes previas
- Cuando editas un producto y subes una nueva imagen, el cliente intentará eliminar la imagen anterior en el servidor llamando a `POST /delete-image` con JSON `{ imageUrl: '/ImgProductos/<archivo>' }`.

Notas finales
- Este servidor es un ejemplo listo para desarrollo. Para producción recomendamos:
  - Usar HTTPS (establecer cookie `secure: true`).
  - Usar un store de sesiones como Redis o una base de datos en lugar de MemoryStore.
  - Añadir validación/limitación adicional y controles de acceso más finos.

Notas:
- Las imágenes subidas se guardan en la carpeta `ImgProductos/` en el proyecto.
- El frontend hace fallback a dataURL si la subida al servidor falla.
