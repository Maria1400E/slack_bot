import { buffer } from 'micro';
import { WebClient } from '@slack/web-api';
import { google } from 'googleapis';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const HORA_INICIO = 18; // 6 PM
const HORA_FIN = 21;    // 9 PM
const ZONA_HORARIA = 'America/Bogota';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const rawBody = (await buffer(req)).toString();

  try {
    const body = JSON.parse(rawBody);

    // Verificación de Slack
    if (body.type === 'url_verification') {
      res.status(200).send(body.challenge);
      return;
    }

    // Procesar mensajes directos al bot
    if (
      body.event &&
      body.event.type === 'message' &&
      body.event.channel_type === 'im' &&
      !body.event.bot_id
    ) {
      await handleMessage(body.event);
    }

    res.status(200).end();
  } catch (error) {
    console.error('Error general:', error);
    res.status(500).send('Internal Server Error');
  }
}

async function handleMessage(event) {
  // Hora actual en Bogotá
  const ahora = new Date().toLocaleString('es-CO', { timeZone: ZONA_HORARIA, hour12: false });
  const horaActual = parseInt(ahora.split(' ')[1]?.split(':')[0]);

  if (horaActual < HORA_INICIO || horaActual >= HORA_FIN) {
    await slack.chat.postMessage({
      channel: event.channel,
      text: '⚠️ Fuera de horario. Por favor, escribe entre *6 PM y 9 PM*.',
    });
    return;
  }

  // Si es el primer mensaje, pide los datos
  if (!event.thread_ts) {
    await slack.chat.postMessage({
      channel: event.channel,
      text: '¡Hola! Por favor, envía en un solo mensaje:\n- Tu correo\n- Descripción del problema\n- Adjunta evidencia si tienes.',
    });
    return;
  }

  try {
    // Obtener datos del usuario
    const userInfo = await slack.users.info({ user: event.user });
    const nombreUsuario = userInfo.user.real_name || userInfo.user.name;
    const fecha = new Date().toLocaleString('es-CO', { timeZone: ZONA_HORARIA });

    // Procesar mensaje
    const [correo, ...descArr] = event.text.split('\n');
    const descripcion = descArr.join('\n').trim();
    const evidencia = event.files?.[0]?.url_private || '';

    if (!correo || !descripcion) {
      await slack.chat.postMessage({
        channel: event.channel,
        text: '❌ Por favor, envía tu correo y una descripción del problema, cada uno en una línea.',
      });
      return;
    }

    // Guardar en Google Sheets
    const ticketId = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
    await saveToGoogleSheets(ticketId, correo, descripcion, evidencia, nombreUsuario, fecha);

    // Confirmación al usuario
    await slack.chat.postMessage({
      channel: event.channel,
      text: `✅ Hemos recibido tu solicitud. Tu número de ticket es: *${ticketId}*.\nTe contactaremos lo antes posible.`,
    });
  } catch (error) {
    console.error('Error procesando el mensaje:', error);
    await slack.chat.postMessage({
      channel: event.channel,
      text: '❌ Hubo un error al registrar tu solicitud. Por favor, inténtalo más tarde.',
    });
  }
}

async function saveToGoogleSheets(ticketId, correo, descripcion, evidencia, nombre, fecha) {
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'A1:F1',
    valueInputOption: 'RAW',
    resource: { values: [[ticketId, correo, descripcion, evidencia, nombre, fecha]] },
  });
}
