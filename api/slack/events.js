const { buffer } = require('micro');
const { WebClient } = require('@slack/web-api');
const { google } = require('googleapis');

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// Configuración de Google Sheets con variables de entorno
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Horario de atención
const HORA_INICIO = 18; // 6 PM
const HORA_FIN = 21;    // 9 PM
const ZONA_HORARIA = 'America/Bogota';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(200).send('Endpoint activo ✔️');
    return;
  }

  const rawBody = (await buffer(req)).toString();
  
  try {
    const body = JSON.parse(rawBody);

    // Verificación de Slack
    if (body.type === 'url_verification') {
      return res.status(200).send(body.challenge);
    }

    // Procesar mensajes directos
    if (body.event?.type === 'message' && body.event?.channel_type === 'im' && !body.event.bot_id) {
      await handleMessage(body.event);
    }

    res.status(200).end();
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error interno');
  }
};

async function handleMessage(event) {
  try {
    // Manejo de horario
    const ahora = new Date().toLocaleString('es-CO', { timeZone: ZONA_HORARIA, hour12: false });
    const horaActual = parseInt(ahora.split(' ')[1].split(':')[0]);

    if (horaActual < HORA_INICIO || horaActual >= HORA_FIN) {
      await slack.chat.postMessage({
        channel: event.channel,
        text: '⚠️ Fuera de horario. Por favor, escribe entre *6 PM y 9 PM*.'
      });
      return;
    }

    // Lógica de interacción
    if (!event.thread_ts) {
      await slack.chat.postMessage({
        channel: event.channel,
        text: '¡Hola! Por favor, envía en un solo mensaje:\n- Tu correo\n- Descripción del problema\n- Adjunta evidencia si tienes.'
      });
      return;
    }

    // Procesar datos
    const userInfo = await slack.users.info({ user: event.user });
    const [correo, ...descArr] = event.text.split('\n');
    const descripcion = descArr.join('\n').trim();

    if (!correo || !descripcion) {
      await slack.chat.postMessage({
        channel: event.channel,
        text: '❌ Por favor, envía tu correo y una descripción del problema, cada uno en una línea.'
      });
      return;
    }

    // Guardar en Google Sheets
    const ticketId = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
    const sheets = google.sheets({ version: 'v4', auth });
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A1:F1',
      valueInputOption: 'RAW',
      resource: {
        values: [[
          ticketId,
          correo.trim(),
          descripcion,
          event.files?.[0]?.url_private || '',
          userInfo.user.real_name || userInfo.user.name,
          new Date().toLocaleString('es-CO', { timeZone: ZONA_HORARIA })
        ]]
      }
    });

    // Confirmación al usuario
    await slack.chat.postMessage({
      channel: event.channel,
      text: `✅ Hemos recibido tu solicitud. Tu número de ticket es: *${ticketId}*`
    });

  } catch (error) {
    console.error('Error en handleMessage:', error);
    await slack.chat.postMessage({
      channel: event.channel,
      text: '❌ Ocurrió un error al procesar tu solicitud.'
    });
  }
}
