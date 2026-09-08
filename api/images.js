/* POST /api/images
 *
 * Listet die bereits hochgeladenen Bilder aus dem Blob-Store auf. Grundlage für
 * den Bild-Picker in der Verwaltung: einem Produkt ein vorhandenes Bild zuweisen,
 * ohne es erneut hochzuladen.
 *
 * POST (statt GET), weil der Firebase-ID-Token im Body übergeben wird und nichts
 * Sensibles in eine URL gehört – URLs landen in Logs, Verläufen und Referrern.
 *
 * Body: { idToken: string, cursor?: string }
 */

import { list } from '@vercel/blob';
import { blobAuth } from './_blob-auth.js';

const FIREBASE_API_KEY = 'AIzaSyDzxxj-kK4eo2RgW-ZQt26cJzHGRs75WbQ';

async function verifyFirebaseToken(idToken) {
  if (!idToken || typeof idToken !== 'string') throw new Error('Nicht angemeldet.');
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
  if (!data.users || !data.users[0]) throw new Error('Anmeldung ungültig.');
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Nur POST erlaubt.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    await verifyFirebaseToken(body.idToken);

    const bilder = [];
    let cursor = undefined;
    let seiten = 0;

    // Alle Seiten einsammeln. Bei einem Katalog dieser Größe sind das ein bis zwei.
    do {
      const seite = await list({ limit: 1000, cursor, ...blobAuth() });
      for (const b of seite.blobs) {
        bilder.push({
          url: b.url,
          name: b.pathname.split('/').pop(),
          bytes: b.size,
          hochgeladen: b.uploadedAt
        });
      }
      cursor = seite.hasMore ? seite.cursor : undefined;
      seiten++;
    } while (cursor && seiten < 10);

    // Neueste zuerst – so liegt das gerade Hochgeladene ganz oben.
    bilder.sort((a, b) => String(b.hochgeladen).localeCompare(String(a.hochgeladen)));

    return res.status(200).json({ bilder, anzahl: bilder.length });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Liste konnte nicht geladen werden.' });
  }
}
