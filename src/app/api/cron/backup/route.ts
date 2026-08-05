import { NextRequest, NextResponse } from "next/server";

import { BackupError } from "@/lib/backup/errors";
import { runScheduledBackupIfDue } from "@/lib/backup/service";

/**
 * Déclencheur de la sauvegarde programmée, appelé par un cron **externe** (crontab de l'hôte,
 * conteneur dédié, ou tout ordonnanceur). On n'utilise pas de timer in-process : l'app tourne
 * derrière `next start`/standalone, un `setInterval` mourrait à chaque redéploiement et se
 * dupliquerait s'il y avait plusieurs instances.
 *
 * L'appelant peut donc taper toutes les heures sans risque : `runScheduledBackupIfDue` ne fait
 * rien tant que l'intervalle configuré n'est pas écoulé.
 *
 * Exemple (crontab de l'hôte, toutes les heures) :
 *   0 * * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" http://127.0.0.1:3001/api/cron/backup
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET n’est pas configuré : la route est désactivée." },
      { status: 503 },
    );
  }
  if (request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const result = await runScheduledBackupIfDue();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BackupError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }
}
