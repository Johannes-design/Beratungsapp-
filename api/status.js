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
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  const status = {
    blobTokenVorhanden: !!token,
    blobLesbar: false,
    anzahlBilder: null,
    hinweis: ''
  };

  if (!token) {
    status.hinweis = 'Der Blob-Store ist nicht mit diesem Projekt verbunden. ' +
                     'In Vercel unter Storage den Store mit dem Projekt verknüpfen, danach neu deployen.';
    return res.status(200).json(status);
  }

  try {
    const seite = await list({ limit: 1 });
    status.blobLesbar = true;
    status.anzahlBilder = seite.blobs.length + (seite.hasMore ? '+' : '');
    status.hinweis = 'Blob-Speicher ist verbunden und erreichbar.';
  } catch (e) {
    status.hinweis = 'Token vorhanden, aber der Zugriff schlug fehl: ' + e.message;
  }

  return res.status(200).json(status);
}
