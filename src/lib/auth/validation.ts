import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("L’adresse e-mail n’est pas valide.").trim().toLowerCase(),
  password: z.string().min(1, "Le mot de passe est obligatoire.").max(200),
});

export interface LoginState {
  error?: string;
  values?: { email: string };
}
