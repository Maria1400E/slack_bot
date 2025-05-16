import { buffer } from 'micro';

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
      if (body.type === 'url_verification') {
        // Slack espera SOLO el challenge como texto plano
        res.status(200).send(body.challenge);
        return;
      }
      // Aquí tu lógica de eventos normales...
      res.status(200).end();
    } catch (err) {
      res.status(400).send('Bad request');
    }
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
