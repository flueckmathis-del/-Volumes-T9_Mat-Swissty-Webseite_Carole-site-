// Sends a notification email to Carole for each new booking via Resend.
// Needs the env vars RESEND_API_KEY and NOTIFY_EMAIL (recipient); optional
// NOTIFY_FROM (sender, defaults to Resend's test sender). Without a key this
// is a no-op so bookings keep working.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function notifyNewBooking(date, booking) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!apiKey || !to) return;

  const [y, m, d] = date.split('-');
  const when = `${d}.${m}.${y} um ${booking.time} Uhr`;
  const rows = [
    ['Termin', when],
    ['Angebot', booking.service || '–'],
    ['Name', booking.name],
    ['E-Mail', booking.email],
    ['Telefon', booking.phone || '–'],
    ['Thema der Beratung', booking.message || '–'],
  ];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || 'CB Ernährung <onboarding@resend.dev>',
      to: [to],
      reply_to: booking.email,
      subject: `Neue Terminbuchung${booking.service ? ` (${booking.service})` : ''}: ${booking.name}, ${when}`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
      html:
        '<h2>Neue Terminbuchung</h2><table cellpadding="6">' +
        rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('') +
        '</table>',
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
