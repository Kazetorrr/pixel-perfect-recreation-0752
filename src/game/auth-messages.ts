// Player-facing wording for backend auth errors, which always arrive in English.
// Only translation lives here; the backend stays authoritative.
export function authErrorMessage(message: string): string {
  const m = message ?? "";
  if (/Invalid login credentials/i.test(m)) return "Neplatný e-mail nebo heslo.";
  if (/Email not confirmed/i.test(m)) return "E-mail zatím nebyl ověřen. Otevřete potvrzovací odkaz, který jsme vám poslali.";
  if (/User already registered/i.test(m)) return "Tenhle e-mail už je zaregistrovaný. Přihlaste se, nebo si nechte poslat nové heslo.";
  if (/For security purposes/i.test(m)) return "Z bezpečnostních důvodů si o e-mail můžete požádat znovu až za chvíli. Zkuste to prosím později.";
  if (/Email rate limit exceeded/i.test(m)) return "Ověřovacích e-mailů už bylo odesláno příliš mnoho. Zkuste to prosím za chvíli.";
  if (/rate limit/i.test(m)) return "Příliš mnoho pokusů za sebou. Zkuste to prosím za chvíli.";
  if (/Password should be at least/i.test(m)) return "Heslo musí mít alespoň 6 znaků.";
  if (/providing a valid email/i.test(m)) return "Zadejte prosím platnou e-mailovou adresu.";
  return m;
}
