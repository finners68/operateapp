/* The browser may only receive the public anon key.
   A service-role or secret key would let anyone bypass organisation rules. */

export function browserKeyProblem(key) {
  const value = String(key || '').trim();
  if (!value || value.includes('YOUR-ANON')) return '';
  if (/^sb_secret_/i.test(value) || /service[_-]?role/i.test(value)) {
    return 'This is a secret key. The app in the browser can only use the public anon key.';
  }
  const parts = value.split('.');
  if (parts.length < 2) return '';
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    if (json && json.role && json.role !== 'anon') {
      return 'This key is for the "' + json.role + '" role. The browser can only use the anon key.';
    }
  } catch {
    return 'This key could not be checked. Use the public anon key from the Supabase dashboard.';
  }
  return '';
}

export function jsString(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/<\/script/gi, '<\\/script');
}
