/** Client feedback only; the server also checks account details and breached passwords. */
export function passwordScore(password: string): number {
  if (password.length < 8) return 0;
  let score = password.length >= 15 ? 3 : password.length >= 12 ? 2 : 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(password)).length;
  if (classes >= 3) score += 1;
  if (/^(.)\1+$/.test(password) || /(password|qwerty|123456|abcdef|letmein)/i.test(password)) score = 1;
  return Math.min(score, 4);
}

export function passwordChecks(current: string, password: string, confirmation: string) {
  return [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Different from current password", met: Boolean(current && password && current !== password) },
    { label: "New passwords match", met: Boolean(password && confirmation === password) },
  ];
}
