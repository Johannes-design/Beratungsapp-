/* POST /api/upload
 *
 * Nimmt ein bereits im Browser auf WebP komprimiertes Bild entgegen und legt es
 * im Vercel-Blob-Store ab. Antwortet mit dem Pfad, unter dem das Bild danach auf
 * der eigenen Domain erreichbar ist (/img/...).
 *
 * Warum der Upload durch diese Funktion läuft statt direkt zum Blob-Store:
 * Die App komprimiert vorher auf WebP (~100–300 KB). Damit bleiben wir weit unter
 * dem 4,5-MB-Limit für Request-Bodies, und wir sparen uns die deutlich fehler-
 * anfälligere Token-Choreografie des Direkt-Uploads.
 *
 * Absicherung: Firebase-ID-Token des angemeldeten Admins, serverseitig bei Google
 * geprüft. Das BLOB_READ_WRITE_TOKEN verlässt niemals den Server.
 *
 * Erwarteter Body (JSON):
 *   idToken     - Firebase-ID-Token des angemeldeten Admins
 *   filename    - ursprünglicher Dateiname (nur für die Lesbarkeit im Store)
 *   contentType - image/webp, image/jpeg oder image/png
 *   data        - die Bilddatei als base64-String
 */

import { put } from '@vercel/blob';

const FIREBASE_API_KEY = 'AIzaSyDzxxj-kK4eo2RgW-ZQt26cJzHGRs75WbQ';
const MAX_BYTES = 4 * 1024 * 1024;
const ERLAUBTE_TYPEN = ['image/webp', 'image/jpeg', 'image/png'];

async function verifyFirebaseToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Nicht angemeldet.');
  }
  const res = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }
  );
  if (!res.ok) throw new Error('Anmeldung abgelaufen – bitte neu anmelden.');
  const data = await res.json();
  const user = data.users && data.users[0];
  if (!user || !user.localId) throw new Error('Anmeldung ungültig.');
  return user.email || user.localId;
}

/* Dateinamen entschärfen: nur Buchstaben, Ziffern, Punkt, Bindestrich, Unterstrich. */
function sauberer_name(name) {
  const basis = String(name || 'bild')
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60);
  return basis || 'bild';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Nur POST erlaubt.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { idToken, filename, contentType, data } = body;

    const email = await verifyFirebaseToken(idToken);

    if (!ERLAUBTE_TYPEN.includes(contentType)) {
      throw new Error('Dateityp nicht erlaubt: ' + contentType);
    }
    if (!data || typeof data !== 'string') {
      throw new Error('Keine Bilddaten empfangen.');
    }

    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length) throw new Error('Bilddaten sind leer.');
    if (buffer.length > MAX_BYTES) {
      throw new Error('Bild zu groß (' + Math.round(buffer.length / 1024) + ' KB, max 4096 KB).');
    }

    const endung = contentType === 'image/webp' ? 'webp'
                 : contentType === 'image/png'  ? 'png'
                 : 'jpg';
    const pfad = 'produkte/' + Date.now() + '-' + sauberer_name(filename).replace(/\.[^.]*$/, '') + '.' + endung;

    const blob = await put(pfad, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true
    });

    // put() liefert die fertige öffentliche URL zurück. Die wird direkt in
    // Firestore gespeichert – dadurch muss nirgends eine Store-ID gepflegt werden.
    console.log('[upload] ' + blob.pathname + ' (' + buffer.length + ' B) von ' + email);

    return res.status(200).json({
      url: blob.url,
      pathname: blob.pathname,
      bytes: buffer.length
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Upload fehlgeschlagen.' });
  }
}
