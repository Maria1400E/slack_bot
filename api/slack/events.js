import { buffer } from 'micro';
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const rawBody = (await buffer(req)).toString();
    try {
      const body = JSON.parse(rawBody);

      // Verificación de Slack
      if (body.type === 'url_verification') {
        res.status(200).send(body.challenge);
        return;
      }

      // Procesa mensajes directos al bot
      if (
        body.event &&
        body.event.type === 'message' &&
        body.event.channel_type === 'im' &&
        !body.event.bot_id
      ) {
        await slack.chat.postMessage({
          channel: body.event.channel,
          text: '¡Hola! Soy tu agente de soporte automático.',
        });
      }

      res.status(200).end();
    } catch (err) {
      console.error('Error:', err);
      res.status(400).send('Bad request');
    }
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
