import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { AppError } from '@/shared/errors';
import { logger } from '@/shared/logger';

/** Nom de fichier sûr (lettres, chiffres, tirets). */
export function safeFileName(name: string, fallback: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return cleaned || fallback;
}

async function share(uri: string, mimeType: string, UTI: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType, UTI, dialogTitle });
  return true;
}

/** Écrit le texte .ics dans le cache de l'app et ouvre la feuille de partage. */
export async function shareIcs(content: string, dialogTitle: string): Promise<boolean> {
  try {
    const file = new File(Paths.cache, 'mysky-calendrier.ics');
    file.write(content);
    return await share(file.uri, 'text/calendar', 'com.apple.ical.ics', dialogTitle);
  } catch (e) {
    logger.error(e, { where: 'shareIcs' });
    throw new AppError('unknown', 'ics share failed', { cause: e });
  }
}

/** Convertit le HTML en PDF (moteur du téléphone) et ouvre la feuille de partage. */
export async function sharePdf(html: string, name: string, dialogTitle: string): Promise<boolean> {
  try {
    const { uri } = await Print.printToFileAsync({ html });
    const target = new File(Paths.cache, `${safeFileName(name, 'note')}.pdf`);
    if (target.exists) target.delete();
    new File(uri).moveSync(target);
    return await share(target.uri, 'application/pdf', 'com.adobe.pdf', dialogTitle);
  } catch (e) {
    logger.error(e, { where: 'sharePdf' });
    throw new AppError('unknown', 'pdf share failed', { cause: e });
  }
}
