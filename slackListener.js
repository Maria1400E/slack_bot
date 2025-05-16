module.exports.listenForDMs = (app, saveTicketToSheet) => {
    // Horario: 18 (6 PM) a 21 (9 PM) hora de Bogotá
    const HORA_INICIO = 18;
    const HORA_FIN = 21;
    const ZONA_HORARIA = 'America/Bogota';

    app.event('message', async ({ event, client }) => {
        if (event.channel_type !== 'im' || event.bot_id) return;

        // Obtén la hora actual en la zona horaria deseada
        const ahora = new Date().toLocaleString('es-CO', { timeZone: ZONA_HORARIA, hour12: false });
        const horaActual = parseInt(ahora.split(' ')[1]?.split(':')[0] || new Date().getHours());

        if (horaActual < HORA_INICIO || horaActual >= HORA_FIN) {
            await client.chat.postMessage({
                channel: event.channel,
                text: '⚠️ Fuera de horario. Por favor, escribe entre *6 PM y 9 PM*.'
            });
            return;
        }

        // Si es el primer mensaje, pide los datos
        if (!event.thread_ts) {
            await client.chat.postMessage({
                channel: event.channel,
                text: '¡Hola! Por favor, envía en un solo mensaje:\n- Tu correo\n- Descripción del problema\n- Adjunta evidencia si tienes.'
            });
            return;
        }

        try {
            const userInfo = await client.users.info({ user: event.user });
            const nombreUsuario = userInfo.user.real_name || userInfo.user.name;
            const fecha = new Date().toLocaleString('es-CO', { timeZone: ZONA_HORARIA });

            const [correo, ...descArr] = event.text.split('\n');
            const descripcion = descArr.join('\n').trim();
            const evidencia = event.files && event.files.length > 0 ? event.files[0].url_private : '';

            if (!correo || !descripcion) {
                await client.chat.postMessage({
                    channel: event.channel,
                    text: '❌ Por favor, envía tu correo y una descripción del problema, cada uno en una línea.'
                });
                return;
            }

            const ticketId = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;

            await saveTicketToSheet([
                ticketId,
                correo.trim(),
                descripcion,
                evidencia,
                nombreUsuario,
                fecha
            ]);

            await client.chat.postMessage({
                channel: event.channel,
                text: `✅ Hemos recibido tu solicitud. Tu número de ticket es: *${ticketId}*.\nTe contactaremos lo antes posible.`
            });
        } catch (error) {
            console.error('Error procesando el mensaje:', error);
            await client.chat.postMessage({
                channel: event.channel,
                text: '❌ Hubo un error al registrar tu solicitud. Por favor, inténtalo más tarde.'
            });
        }
    });
};
