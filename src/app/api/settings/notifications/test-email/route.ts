import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { canManageNotifications } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { getEmailConfig } from "@/lib/settings/runtime-config";

const bodySchema = z.object({
  to: z.string().trim().toLowerCase().email("L’adresse e-mail n’est pas valide.").max(200),
});

/** E-mail de test, pour vérifier la clé Resend et l'adresse d'expédition. */
export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!canManageNotifications(user?.role)) {
    return NextResponse.json({ error: "Droits administrateur requis." }, { status: 403 });
  }

  const config = await getEmailConfig();
  if (!config) {
    return NextResponse.json(
      { error: "L’e-mail n’est pas configuré : renseignez la clé Resend et l’adresse d’expédition." },
      { status: 409 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const result = await sendEmail({
    to: parsed.data.to,
    subject: "Test de configuration — Damaschin CRM",
    text:
      "Cet e-mail confirme que l'envoi depuis Damaschin CRM fonctionne.\n\n"
      + `Expéditeur configuré : ${config.from}`,
    html:
      `<p>Cet e-mail confirme que l’envoi depuis <strong>Damaschin CRM</strong> fonctionne.</p>`
      + `<p style="color:#6d7386;font-size:13px">Expéditeur configuré : ${config.from}</p>`,
  });

  if (!result.sent) {
    return NextResponse.json(
      {
        // Le message de Resend est repris tel quel : c'est lui qui dit « domaine non vérifié »
        // ou « clé invalide », impossible à deviner autrement.
        error:
          result.reason === "not-configured"
            ? "Configuration e-mail incomplète."
            : `Envoi refusé par Resend${result.error ? ` (${result.error})` : ""}. `
              + "Vérifiez la clé et que le domaine de l’expéditeur est bien vérifié chez Resend.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, message: `E-mail de test envoyé à ${parsed.data.to}.` });
}
