/* Ermittelt die Zugangsdaten für den Blob-Store.
 *
 * Vercel kennt zwei Verfahren, und welches beim Verbinden eines Stores angelegt
 * wird, hängt vom Alter des Projekts ab:
 *
 *   alt  – ein fester Schlüssel in BLOB_READ_WRITE_TOKEN
 *   neu  – ein automatisch rotierender VERCEL_OIDC_TOKEN plus BLOB_STORE_ID
 *
 * Dieses Projekt hat BLOB_STORE_ID, also das neue Verfahren. Hier werden beide
 * unterstützt, damit ein späterer Wechsel nichts kaputt macht.
 *
 * Rückgabe ist ein Options-Objekt, das direkt an put()/list() weitergereicht wird.
 */

export function blobAuth() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) return { token };

  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  if (oidcToken && storeId) return { oidcToken, storeId };

  const fehlt = [];
  if (!oidcToken) fehlt.push('VERCEL_OIDC_TOKEN');
  if (!storeId) fehlt.push('BLOB_STORE_ID');
  throw new Error(
    'Blob-Speicher nicht erreichbar – es fehlt: ' + fehlt.join(', ') + '. ' +
    'In den Projekteinstellungen "Secure Backend Access (OIDC)" aktivieren ' +
    'oder den Store neu mit dem Projekt verbinden.'
  );
}

/* Nur für die Diagnose: welche einschlägigen Variablen existieren?
   Gibt ausschließlich Namen zurück, niemals Werte. */
export function blobEnvNamen() {
  return Object.keys(process.env)
    .filter(n => /BLOB|OIDC/i.test(n))
    .sort();
}
