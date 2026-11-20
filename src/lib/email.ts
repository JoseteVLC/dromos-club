import "server-only";

/**
 * Envío de emails, de dos formas (la que esté configurada en Vercel):
 * · SMTP de tu correo (p. ej. una cuenta de SiteGround): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y EMAIL_FROM.
 * · Resend: RESEND_API_KEY y EMAIL_FROM.
 */
const smtpReady = () => !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
export const hasEmail = () => smtpReady() || (!!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM);

/** Envía un email. Devuelve null si ha ido bien o el mensaje de error. */
export async function sendEmail(m: { to: string; subject: string; html: string; text: string; replyTo?: string | null }): Promise<string | null> {
  if (!hasEmail()) return "Falta configurar el envío de emails (SMTP o RESEND_API_KEY en Vercel).";
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER!;
  try {
    if (smtpReady()) {
      const { createTransport } = await import("nodemailer");
      const port = Number(process.env.SMTP_PORT || 465);
      const tx = createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 15000,
      });
      await tx.sendMail({ from, to: m.to, subject: m.subject, html: m.html, text: m.text, ...(m.replyTo ? { replyTo: m.replyTo } : {}) });
      return null;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text, ...(m.replyTo ? { reply_to: m.replyTo } : {}) }),
    });
    if (res.ok) return null;
    const j = (await res.json().catch(() => null)) as { message?: string } | null;
    return j?.message ?? `Error ${res.status}`;
  } catch (e) {
    return e instanceof Error ? e.message : "No se ha podido enviar.";
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Email de bienvenida con la invitación. Maquetado con tablas y estilos en línea para que se vea bien en Gmail, Outlook y el Mail del iPhone.
 * Textos ya traducidos al idioma de quien invita.
 */
export function inviteEmail(o: {
  brand: string;
  accent: string;
  accentFg: string;
  logoUrl: string | null;
  name: string;
  link: string;
  role: "athlete" | "coach";
  inviter: string | null;
  /** TrainCult: clientes de la plani (sin hablar de «box»). Dromos: un box. */
  plani?: boolean;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const { t } = o;
  const subject = t("{name}, te esperamos en {brand}", { name: o.name, brand: o.brand });
  const intro = o.plani
    ? o.inviter
      ? t("{inviter} te ha invitado a {brand}, la app donde los atletas de la plani de TrainCult apuntan sus WODs y sus marcas y compiten en el ranking.", { inviter: o.inviter, brand: o.brand })
      : t("Te han invitado a {brand}, la app donde los atletas de la plani de TrainCult apuntan sus WODs y sus marcas y compiten en el ranking.", { brand: o.brand })
    : o.inviter
    ? t("{inviter} te ha invitado a {brand}, la app donde el box apunta sus WODs, sus marcas y compite en el ranking.", { inviter: o.inviter, brand: o.brand })
    : t("Te han invitado a {brand}, la app donde el box apunta sus WODs, sus marcas y compite en el ranking.", { brand: o.brand });
  const points =
    o.role === "coach"
      ? [t("Publica la plani y ve los resultados de todos al momento."), t("Responde dudas del WOD y escribe a tus atletas."), o.plani ? t("Un panel con quién entrena y quién se está descolgando.") : t("Panel del box con quién entrena y quién se está descolgando.")]
      : [t("Mete tu resultado de cada WOD y mira dónde quedas en el ranking."), t("Guarda tus marcas, ve tu progreso y calcula pesos y discos."), t("Gana medallas, mantén la racha y pregunta tus dudas al coach.")];
  const cta = t("Crear mi cuenta");
  const header = o.logoUrl
    ? `<img src="${esc(o.logoUrl)}" alt="${esc(o.brand)}" height="34" style="display:block;height:34px;border:0" />`
    : `<span style="font:800 24px/1 Arial,Helvetica,sans-serif;letter-spacing:.5px;color:#ffffff">${esc(o.brand.toUpperCase())}</span>`;

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"></head>
<body style="margin:0;padding:0;background:#0c0d10">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0d10"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#16171b;border-radius:16px;overflow:hidden">
<tr><td style="padding:26px 28px 18px">${header}</td></tr>
<tr><td style="height:4px;background:${o.accent};line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px;font:800 30px/1.15 Arial,Helvetica,sans-serif;color:#ffffff">${esc(t("¡Hola, {name}!", { name: o.name }))}</td></tr>
<tr><td style="padding:6px 28px 4px;font:16px/1.55 Arial,Helvetica,sans-serif;color:#d4d4d8">${esc(intro)}</td></tr>
<tr><td style="padding:14px 28px 6px">
${points
  .map(
    (p) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr>
<td valign="top" style="padding:7px 12px 0 0"><div style="width:8px;height:8px;border-radius:4px;background:${o.accent}"></div></td>
<td style="font:15px/1.5 Arial,Helvetica,sans-serif;color:#e4e4e7">${esc(p)}</td></tr></table>`,
  )
  .join("")}
</td></tr>
<tr><td align="center" style="padding:18px 28px 8px">
<a href="${esc(o.link)}" style="display:inline-block;background:${o.accent};color:${o.accentFg};font:800 16px/1 Arial,Helvetica,sans-serif;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:17px 34px;border-radius:10px">${esc(cta)}</a>
</td></tr>
<tr><td style="padding:10px 28px 4px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#a1a1aa;text-align:center">${esc(t("Solo tienes que elegir tu contraseña y ya estás dentro. Después, añádela a la pantalla de inicio del móvil para tenerla como una app."))}</td></tr>
<tr><td style="padding:18px 28px 26px;font:12px/1.5 Arial,Helvetica,sans-serif;color:#71717a;text-align:center">${esc(t("Si el botón no funciona, copia este enlace en el navegador:"))}<br><a href="${esc(o.link)}" style="color:#a1a1aa;word-break:break-all">${esc(o.link)}</a></td></tr>
</table>
<p style="font:12px/1.5 Arial,Helvetica,sans-serif;color:#52525b;margin:16px 0 0">${esc(t("Te llega este email porque alguien de {brand} te ha invitado. Si no esperabas esta invitación, ignóralo.", { brand: o.brand }))}</p>
</td></tr></table></body></html>`;

  const text = [t("¡Hola, {name}!", { name: o.name }), "", intro, "", ...points.map((p) => `· ${p}`), "", `${cta}: ${o.link}`, "", t("Solo tienes que elegir tu contraseña y ya estás dentro. Después, añádela a la pantalla de inicio del móvil para tenerla como una app.")].join("\n");
  return { subject, html, text };
}
