/* GET /api/status
 *
 * Selbstauskunft: Ist der Blob-Speicher angeschlossen und beschreibbar?
 * Gedacht zum Prüfen nach einem Deployment, ohne dass sich jemand anmelden muss.
 *
 * Gibt bewusst nur Namen und Ja/Nein zurück – niemals Tokens oder Teile davon.
 */

import { list } from '@vercel/blob';
import { blobAuth, blobEnvNamen, blobQuelle } from './_blob-auth.js';

export default async function handler(req, res) {
  const status = {
    gefundeneVariablen: blobEnvNamen(),
    verfahren: null,
    blobLesbar: false,
    anzahlBilder: null,
    hinweis: ''
  };

  let auth;
  try {
    auth = blobAuth();
    status.verfahren = blobQuelle();
  } catch (e) {
    status.hinweis = e.message;
    return res.status(200).json(status);
  }

  try {
    const seite = await list({ limit: 1, ...auth });
    status.blobLesbar = true;
    status.anzahlBilder = seite.blobs.length + (seite.hasMore ? '+' : '');
    status.hinweis = 'Blob-Speicher ist verbunden und erreichbar.';
  } catch (e) {
    status.hinweis = 'Zugangsdaten vorhanden, aber der Zugriff schlug fehl: ' + e.message;
  }

  return res.status(200).json(status);
}
