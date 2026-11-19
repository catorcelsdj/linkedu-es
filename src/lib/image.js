// Recorta al centro en cuadrado y reduce a 256 px. Así la foto pesa poco y se eliminan los metadatos (EXIF, ubicación).
export async function squareJpeg(file, size = 256) {
  let bmp
  try { bmp = await createImageBitmap(file) } catch { throw new Error('No se pudo leer la imagen. Prueba con un JPG o PNG.') }
  const s = Math.min(bmp.width, bmp.height)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  if (!ctx) { bmp.close(); throw new Error('No se pudo procesar la imagen.') }
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size)
  ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size)
  bmp.close()
  return new Promise((ok, fail) => c.toBlob(b => (b ? ok(b) : fail(new Error('No se pudo procesar la imagen.'))), 'image/jpeg', 0.88))
}
