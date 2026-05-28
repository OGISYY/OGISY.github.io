# 📁 Carpeta media/ — Guía de uso

Aquí van todas las imágenes y videos del portfolio.
Las imágenes y videos de esta carpeta se referencian desde los HTML con rutas relativas.

---

## 📂 Estructura

```
media/
├── demons-bell/
│   ├── blocking/        ← Capturas de la fase de blocking (JPG/PNG)
│   ├── props/           ← Capturas y renders de props/assets (JPG/PNG)
│   ├── materials/       ← Renders de materiales de Substance Designer (JPG/PNG)
│   ├── videos/          ← Vídeos del proyecto (MP4, max ~50MB por vídeo)
│   └── thumbnails/      ← Miniaturas para los vídeos (JPG, 1280×720)
│
└── personal-projects/
    ├── blender-addon/   ← Capturas del addon
    ├── vr-tururut/      ← Capturas del trabajo en Tururut
    ├── player-to-player/← Capturas del juego
    └── variedad/        ← Capturas de materiales, VFX, etc.
```

---

## 🖼️ Cómo añadir una IMAGEN

1. Coloca el archivo en la carpeta correcta (por ejemplo `media/demons-bell/blocking/`)
2. Formatos recomendados: **JPG** (fotos/capturas) · **PNG** (capturas con transparencia)
3. Tamaño recomendado: 1920×1080 o 2560×1440 · Peso máximo: 2MB por imagen
4. En `index.html`, busca el comentario `IMÁGENES — BLOCKING` (o PROPS / MATERIALS)
   y añade debajo:

```html
<div class="gallery-item">
  <img src="media/demons-bell/blocking/NOMBRE_DEL_ARCHIVO.jpg" alt="Descripción">
  <div class="gallery-caption">Tu descripción aquí</div>
</div>
```

Para imagen grande (ocupa 2 columnas de galería):
```html
<div class="gallery-item gallery-item-large">
  <img src="media/demons-bell/blocking/NOMBRE.jpg" alt="Descripción">
  <div class="gallery-caption">Tu descripción aquí</div>
</div>
```

---

## 🎬 Cómo añadir un VÍDEO

1. Exporta el vídeo como **MP4** (H.264, max ~50MB)
2. Coloca el archivo en `media/demons-bell/videos/`
3. Opcionalmente añade una miniatura JPG en `media/demons-bell/thumbnails/`
4. En `index.html`, busca el comentario `VIDEO — BLOCKING` (o PROPS / MATERIALS / OVERVIEW)
   y reemplaza el bloque de placeholder con:

```html
<video
  src="media/demons-bell/videos/NOMBRE.mp4"
  controls
  poster="media/demons-bell/thumbnails/NOMBRE.jpg"
></video>
```

Si no tienes miniatura, puedes omitir el atributo `poster`:
```html
<video src="media/demons-bell/videos/NOMBRE.mp4" controls></video>
```

---

## 💡 Tips

- Los comentarios en el HTML tienen el formato `═══ VIDEO/IMÁGENES — SECCIÓN ═══`
  para que sean fáciles de encontrar con Ctrl+F
- Para vídeos muy largos o pesados, considera subirlos a YouTube/Vimeo
  y usar un `<iframe>` en lugar de `<video>`:

```html
<iframe
  src="https://www.youtube.com/embed/TU_VIDEO_ID"
  frameborder="0" allowfullscreen
  style="width:100%;height:100%"
></iframe>
```

