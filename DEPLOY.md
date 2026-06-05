# 🚀 Cómo publicar Northstone

Sigue estos pasos en orden. Cada uno lleva unos minutos.

---

## Paso 1 — Crea las 3 cuentas gratuitas

1. **GitHub** → https://github.com/signup  
   (guarda tu usuario y contraseña)

2. **Vercel** → https://vercel.com/signup  
   → Elige "Continue with GitHub" (se conectan solos)

3. **Supabase** → https://supabase.com/dashboard/sign-up  
   → Crea cuenta y luego un proyecto nuevo llamado "northstone"

---

## Paso 2 — Sube el código a GitHub

1. Ve a https://github.com/new
2. Ponle de nombre: `northstone`
3. Deja todo por defecto y clic en **Create repository**
4. En tu ordenador, abre la Terminal (en Mac: Spotlight → Terminal)
5. Ejecuta estos comandos (copia y pega uno a uno):

```bash
cd ~/Desktop/NORTHSTONE
git init
git add .
git commit -m "Northstone v1.0"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/northstone.git
git push -u origin main
```

*(Cambia TU_USUARIO por tu nombre de usuario de GitHub)*

---

## Paso 3 — Publica con Vercel

1. Ve a https://vercel.com/new
2. Clic en **Import** junto a tu repositorio `northstone`
3. Deja todo por defecto (Vercel detecta Vite automáticamente)
4. Clic en **Deploy**
5. En 2 minutos tendrás una URL tipo: `northstone-xxx.vercel.app`

✅ **¡Ya tienes la app online!** Funciona con datos locales (localStorage).

---

## Paso 4 — Conectar Supabase (datos en la nube)

1. En tu proyecto de Supabase, ve a **SQL Editor**
2. Copia y pega el contenido del archivo `supabase/schema.sql`
3. Clic en **Run** — se crean todas las tablas

4. Ve a **Settings → API** en Supabase y copia:
   - Project URL
   - anon public key

5. En Vercel, ve a tu proyecto → **Settings → Environment Variables**
6. Añade estas dos variables:
   - `VITE_SUPABASE_URL` = (tu Project URL)
   - `VITE_SUPABASE_ANON_KEY` = (tu anon key)

7. Ve a **Deployments** y haz clic en **Redeploy**

✅ **¡Listo!** Los datos ahora se guardan en la nube.

---

## Instalar como app en el móvil (iOS)

1. Abre la URL de tu app en Safari
2. Toca el botón de compartir (cuadrado con flecha hacia arriba)
3. Toca **"Añadir a pantalla de inicio"**
4. Ya tienes la app como si fuera nativa 📱

---

## Dar acceso a tus deportistas

Comparte simplemente la URL. Cada uno puede instalarla en su móvil.  
*(Para login individual, pídeme que añada autenticación cuando quieras)*

---

## ¿Necesitas ayuda?

Pídeme cualquier cosa:
- Añadir login con email/contraseña
- Notificaciones push
- Estadísticas y gráficas
- Exportar datos a PDF
- Personalizar colores o logo
