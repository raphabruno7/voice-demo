import { cookies, headers } from "next/headers";

export type Lang = "pt" | "en";

export async function getLang(): Promise<Lang> {
  const cookieLang = (await cookies()).get("lang")?.value;
  if (cookieLang === "pt" || cookieLang === "en") return cookieLang;

  const acceptLanguage = (await headers()).get("accept-language") ?? "";
  return acceptLanguage.toLowerCase().startsWith("pt") ? "pt" : "en";
}
