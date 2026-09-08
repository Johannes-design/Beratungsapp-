/* GET /api/status
 *
 * Selbstauskunft: Ist der Blob-Speicher angeschlossen und beschreibbar?
 * Gedacht zum Prüfen nach einem Deployment, ohne dass sich jemand anmelden muss.
 *
 * Gibt bewusst nur Namen und Ja/Nein zurück – niemals Tokens oder Teile davon.
 */

import { list, put, del } from '@vercel/blob';
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
    return res.status(200).json(status);
  }

  /* Schreibtest nur auf ausdrückliche Anforderung (?schreibtest=1).
     Legt eine winzige Datei an, ruft sie öffentlich ab und löscht sie wieder.
     Damit ist der komplette Upload-Weg belegt, ohne dass sich jemand anmelden muss. */
  if (req.query && req.query.schreibtest === '1') {
    status.schreibtest = { geschrieben: false, oeffentlichLesbar: false, aufgeraeumt: false };
    let url = null;
    try {
      const probe = await put(
        'selbsttest/' + Date.now() + '.txt',
        'Selbsttest der Beratungsapp – diese Datei wird sofort wieder geloescht.',
        { access: 'public', contentType: 'text/plain', addRandomSuffix: true, ...auth }
      );
      url = probe.url;
      status.schreibtest.geschrieben = true;

      // Ohne Anmeldung abrufbar? Genau das muss ein <img>-Tag später auch können.
      const abruf = await fetch(url, { cache: 'no-store' });
      status.schreibtest.oeffentlichLesbar = abruf.ok;
      status.schreibtest.abrufStatus = abruf.status;
      status.schreibtest.hostname = new URL(url).hostname;
    } catch (e) {
      status.schreibtest.fehler = e.message;
    }

    if (url) {
      try { await del(url, auth); status.schreibtest.aufgeraeumt = true; }
      catch (e) { status.schreibtest.aufraeumFehler = e.message; }
    }
  }

  return res.status(200).json(status);
}
