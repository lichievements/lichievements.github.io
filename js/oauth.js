// ============================================================================
// Lichess OAuth2 — Authorization Code flow with PKCE (public client, no secret)
// ============================================================================

const LICHESS = 'https://lichess.org';
const AUTH_URL = `${LICHESS}/oauth`;
const TOKEN_URL = `${LICHESS}/api/token`;
const ACCOUNT_URL = `${LICHESS}/api/account`;

// Identifying the user and reading public account data needs no scope. Two
// extra achievement sources are private, so we request read-only access to
// them: `study:read` (has the user authored a study?) and `follow:read`
// (whom does the user follow?). Games, teams and tournaments stay public.
const SCOPE = 'study:read follow:read';

const REDIRECT_URI = location.origin + location.pathname;
const CLIENT_ID = REDIRECT_URI; // arbitrary stable string; the deployed URL is convention

const SS_VERIFIER = 'li_verifier';
const SS_STATE = 'li_state';

function randomString(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return base64url(a.buffer);
}

function base64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function challengeFrom(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(digest);
}

// Kick off the redirect to Lichess.
export async function login() {
  const verifier = randomString(48);
  const state = randomString(16);
  sessionStorage.setItem(SS_VERIFIER, verifier);
  sessionStorage.setItem(SS_STATE, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: await challengeFrom(verifier),
    state,
  });
  if (SCOPE) params.set('scope', SCOPE);
  location.href = `${AUTH_URL}?${params}`;
}

// If we came back from Lichess with ?code, exchange it for a token.
// Returns an access token string, or null if this isn't a redirect.
export async function completeLoginIfRedirected() {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const authError = url.searchParams.get('error');

  // Always clean the URL so a refresh doesn't re-run the exchange.
  const clean = () => history.replaceState({}, '', REDIRECT_URI);

  if (authError) { clean(); throw new Error(`Lichess authorization was declined (${authError}).`); }
  if (!code) return null;

  const verifier = sessionStorage.getItem(SS_VERIFIER);
  const expectedState = sessionStorage.getItem(SS_STATE);
  sessionStorage.removeItem(SS_VERIFIER);
  sessionStorage.removeItem(SS_STATE);
  clean();

  if (!verifier || returnedState !== expectedState) {
    throw new Error('Login state mismatch. Please try logging in again.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error('Could not obtain an access token from Lichess.');
  const json = await res.json();
  if (!json.access_token) throw new Error('Lichess did not return an access token.');
  return json.access_token;
}

export async function fetchAccount(token) {
  const res = await fetch(ACCOUNT_URL, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Could not load your Lichess account.');
  return res.json();
}

// Best-effort token revocation on logout.
export async function revoke(token) {
  try {
    await fetch(TOKEN_URL, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  } catch { /* ignore */ }
}
