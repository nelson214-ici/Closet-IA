# Closet AI Stylist — Despliegue en Vercel

Una guía paso a paso para tener tu app en tu iPhone en ~15 minutos. Sin saber programar.

---

## Lo que vas a hacer

1. Crear cuenta en Anthropic y obtener tu API key
2. Crear cuenta en Vercel
3. Subir esta carpeta a Vercel
4. Pegar tu API key como variable de entorno
5. Abrir la URL en Safari del iPhone y añadirla a la pantalla de inicio

Costo total: **gratis** (con $5 USD de crédito inicial en Anthropic que dura meses para uso personal).

---

## Paso 1 — API Key de Anthropic (3 min)

1. Entra a [console.anthropic.com](https://console.anthropic.com)
2. **Sign up** con tu Google o email
3. Verifica tu email
4. Te dan $5 USD de crédito gratis. Suficiente para ~500-1000 outfits generados.
5. Ve a **Settings → API Keys → Create Key**
6. Le pones cualquier nombre (ej: "Closet AI")
7. **Copia la key completa** y guárdala en un lugar seguro. Empieza con `sk-ant-...`
   - ⚠️ No la podrás ver de nuevo. Si la pierdes, creas una nueva.

---

## Paso 2 — Cuenta en Vercel (2 min)

1. Entra a [vercel.com](https://vercel.com)
2. **Sign Up** → elige **Continue with GitHub** (lo más fácil) o con email
   - Si no tienes GitHub, crea una cuenta gratis en github.com primero
3. Acepta el plan **Hobby** (gratis)
4. Listo, estás dentro

---

## Paso 3 — Subir esta carpeta (5 min)

Tienes dos opciones. **La A es más fácil si nunca usaste Git.**

### Opción A — Drag & drop (recomendada)

1. En el dashboard de Vercel, click **"Add New..."** → **"Project"**
2. Busca el botón **"Import Third-Party Git Repository"** y debajo: **"deploy from local"** o **"Browse..."**
3. **Importante:** Si no ves la opción de subir archivos directamente, sigue Opción B.

### Opción B — Vía GitHub (más común)

1. Entra a [github.com](https://github.com) y crea un repositorio nuevo:
   - **Repository name:** `closet-ai`
   - **Public** ✅
   - Click **Create repository**
2. En la página del repo recién creado, click **"uploading an existing file"**
3. **Descomprime el zip** que te di y arrastra **TODOS los archivos** dentro (no la carpeta, los archivos sueltos):
   - `index.html`
   - `app.js`
   - `manifest.json`
   - `vercel.json`
   - `package.json`
   - La carpeta `api/`
4. Click **"Commit changes"** abajo
5. Vuelve a Vercel → **"Add New..."** → **"Project"** → busca tu repo `closet-ai` → **Import**
6. En la pantalla de configuración:
   - **Framework Preset:** Other
   - **No toques nada más**
   - Click **"Environment Variables"** y agrega una:
     - Name: `ANTHROPIC_API_KEY`
     - Value: la key que copiaste en el Paso 1 (`sk-ant-...`)
   - Click **"Add"**
7. Click **"Deploy"**
8. Espera ~30 segundos. Cuando termine, te muestra la URL: algo como `closet-ai-tunombre.vercel.app`

---

## Paso 4 — Instalar en tu iPhone (1 min)

1. Abre **Safari** en tu iPhone (importante: Safari, no Chrome ni otros)
2. Entra a tu URL de Vercel (la que te dio en el paso anterior)
3. Toca el botón **Compartir** abajo (cuadrado con flecha hacia arriba)
4. Baja en el menú y toca **"Añadir a pantalla de inicio"**
5. Le pones nombre "Closet AI" y toca **Añadir**

¡Listo! Tienes la app como ícono en tu pantalla. Se abre sin barra del navegador.

---

## Solución de problemas

**"Error: API key not configured"**
- Vuelve a Vercel → tu proyecto → **Settings** → **Environment Variables**
- Verifica que `ANTHROPIC_API_KEY` esté ahí y bien pegada
- Vuelve a deployar: **Deployments** → tres puntos del último → **Redeploy**

**"Error 429 / rate limit"**
- Llegaste al límite del plan gratuito de Anthropic. Espera unos minutos o agrega crédito.

**No genera outfits**
- Abre la consola del navegador en tu computador (botón derecho → Inspeccionar → Console)
- Te dirá qué error específico hay

**Cambié algo del código y no se ve**
- Vercel auto-despliega cada cambio que subes a GitHub. Espera 30 segundos y refresca.

---

## Costos reales

- Vercel: $0 (plan Hobby es gratis para uso personal, hasta 100 GB de tráfico)
- Anthropic: ~$0.003 por outfit generado. Con $5 de crédito gratis tienes para ~1500 outfits.
- Si pasas de eso: agregas $5-10 USD y dura meses.

---

## Próximos pasos

Cuando quieras evolucionar a app nativa real para App Store, ya tienes:
- El proyecto SwiftUI completo (otro zip que te di antes)
- Este backend funcionando como API proxy

Solo conectas la app SwiftUI a la misma URL de Vercel y listo.
