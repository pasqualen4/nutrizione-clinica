import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://qjocvyauwuhrrlmlkfit.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2Dp5S6sz6S0PORdUfqbHtw_rnT1njrh';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const runtimeParts = [
  './runtime/part00.txt',
  './runtime/part01.txt',
  './runtime/part02.txt',
  './runtime/part03.txt',
  './runtime/part04.txt',
  './runtime/part05.txt'
];

try {
  const parts = await Promise.all(runtimeParts.map(async path => {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Impossibile caricare ${path}: ${response.status}`);
    return response.text();
  }));
  parts[3] = parts[3].replace(/\n?init\(\);\s*$/, '\n');
  const runtime = `${parts.join('')}\ninit();\n`;
  new Function('supabase', runtime)(supabase);
} catch (error) {
  console.error(error);
  const auth = document.querySelector('#authView');
  if (auth) auth.innerHTML = `<div class="auth-card"><div class="brand-mark">NC</div><h1>Errore di caricamento</h1><p class="error-text">${String(error?.message || error)}</p><p>Ricarica la pagina. Se il problema continua, verifica il deploy dell’applicazione.</p></div>`;
}
