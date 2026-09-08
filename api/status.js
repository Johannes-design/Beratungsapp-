/* GET /api/status
 *
 * Kleine Selbstauskunft der App: Ist der Blob-Speicher angeschlossen und
 * beschreibbar? Gedacht zum Prüfen nach einem Deployment, ohne dass sich
 * jemand dafür anmelden muss.
 *
 * Gibt bewusst NUR Ja/Nein zurück – niemals den Token oder Teile davon.
 */

import { list } from '@vercel/blob';

export default async function handler(req, res) {
  // Beim Verbinden eines Blob-Stores heißt die Variable normalerweise
  // BLOB_READ_WRITE_TOKEN. Bekommt der Store ein Präfix, entsteht daraus z. B.
  // BERATUNG_BLOB_READ_WRITE_TOKEN. Deshalb hier nach jedem passenden Namen suchen.
  const kandidaten = Object.keys(process.env).filter(n => /BLOB.*READ_WRITE_TOKEN$/.test(n));
  const name = process.env.BLOB_READ_WRITE_TOKEN ? 'BLOB_READ_WRITE_TOKEN' : kandidaten[0];
  const token = name ? process.env[name] : null;

  const status = {
    blobTokenVorhanden: !!token,
    verwendeteVariable: name || null,
    // Nur NAMEN, niemals Werte – damit hier nichts Geheimes nach außen gelangt.
    gefundeneBlobVariablen: kandidaten,
    blobLesbar: false,
    anzahlBilder: null,
    hinweis: ''
  };

  if (!token) {
    status.hinweis = 'Keine Blob-Zugangsvariable in dieser Umgebung. Entweder ist der Store ' +
                     'nicht mit dem Projekt verbunden, oder er ist nur der Production-Umgebung ' +
                     'zugeordnet und fehlt in Preview.';
    return res.status(200).json(status);
  }

  try {
    const seite = await list({ limit: 1, token });
    status.blobLesbar = true;
    status.anzahlBilder = seite.blobs.length + (seite.hasMore ? '+' : '');
    status.hinweis = 'Blob-Speicher ist verbunden und erreichbar.';
  } catch (e) {
    status.hinweis = 'Token vorhanden, aber der Zugriff schlug fehl: ' + e.message;
  }

  return res.status(200).json(status);
}
