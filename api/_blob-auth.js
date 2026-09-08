/* Ermittelt die Zugangsdaten für den Blob-Store.
 *
 * Die Namen der Variablen hängen davon ab, wie der Store angelegt wurde. Ohne
 * Präfix heißen sie BLOB_READ_WRITE_TOKEN und BLOB_STORE_ID; mit dem Präfix
 * KATALOG entsprechend KATALOG_READ_WRITE_TOKEN und KATALOG_STORE_ID.
 *
 * Dieses Projekt hat zwei Stores verbunden – den alten privaten (BLOB_*, leer,
 * unbenutzt) und den öffentlichen für den Katalog (KATALOG_*). Deshalb wird hier
 * nicht auf feste Namen gesetzt, sondern nach einem Schreib-Token gesucht und die
 * Store-ID mit DEMSELBEN Präfix dazugeholt. Sonst käme der Token des einen Stores
 * mit der ID des anderen zusammen.
 */

/* Bevorzugt einen Store, dessen Präfix auf den Katalog hindeutet; sonst den
   ersten gefundenen. So bleibt es auch bei einer Umbenennung funktionsfähig. */
function tokenVariableFinden() {
  const alle = Object.keys(process.env).filter(n => /(^|_)READ_WRITE_TOKEN$/.test(n));
  if (!alle.length) return null;
  return alle.find(n => n.startsWith('KATALOG')) || alle.sort()[0];
}

export function blobAuth() {
  const tokenVar = tokenVariableFinden();
  if (!tokenVar) {
    throw new Error(
      'Kein Schreib-Token für den Blob-Speicher gefunden. In Vercel unter Storage ' +
      'beim verbundenen Store "Add a read-write token env var" aktivieren und neu deployen.'
    );
  }

  const praefix = tokenVar.replace(/_?READ_WRITE_TOKEN$/, '');
  const storeIdVar = praefix ? praefix + '_STORE_ID' : 'BLOB_STORE_ID';

  const auth = { token: process.env[tokenVar] };
  // Store-ID nur mitgeben, wenn sie zum selben Präfix gehört.
  if (process.env[storeIdVar]) auth.storeId = process.env[storeIdVar];
  return auth;
}

/* Nur für die Diagnose: welche einschlägigen Variablen existieren?
   Gibt ausschließlich Namen zurück, niemals Werte. */
export function blobEnvNamen() {
  return Object.keys(process.env)
    .filter(n => /BLOB|READ_WRITE_TOKEN|STORE_ID/i.test(n))
    .sort();
}

/* Für die Statusanzeige: welcher Store wird gerade benutzt? */
export function blobQuelle() {
  const tokenVar = tokenVariableFinden();
  if (!tokenVar) return null;
  const praefix = tokenVar.replace(/_?READ_WRITE_TOKEN$/, '');
  return { tokenVariable: tokenVar, storeIdVariable: (praefix || 'BLOB') + '_STORE_ID' };
}
