const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

module.exports.saveTicketToSheet = async (rowData) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A1:F1',
      valueInputOption: 'RAW',
      resource: {
        values: [rowData]
      }
    });
  } catch (err) {
    console.error('Error guardando en Google Sheets:', err);
    throw err;
  }
};
