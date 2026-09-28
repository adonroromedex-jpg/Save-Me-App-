import { getSupabaseClient } from './supabase';

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    phone: user.user_metadata?.phone || '',
    firstName: user.user_metadata?.firstName || '',
    name: user.user_metadata?.name || '',
  };
}

export async function registerAccount(form) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: form.email.trim(),
    password: form.password,
    options: {
      data: {
        firstName: form.firstName.trim(),
        name: form.name.trim(),
        phone: form.phone.trim(),
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function loginAccount(email, password) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim(), password,
  });
  if (error) throw error;
  return data.user;
}

export async function startPhoneChallenge(phone) {
  const client = getSupabaseClient();
  const { data: factors, error: listError } = await client.auth.mfa.listFactors();
  if (listError) throw listError;

  let factor = factors.phone?.[0];
  if (!factor) {
    if (!/^\+[1-9]\d{7,14}$/.test(phone || '')) {
      throw new Error('Antre nimewo a ak kòd peyi a, pa egzanp +509XXXXXXXX.');
    }
    const { data, error } = await client.auth.mfa.enroll({
      factorType: 'phone', phone, friendlyName: 'Save Me SMS',
    });
    if (error) throw error;
    factor = data;
  }

  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({
    factorId: factor.id,
  });
  if (challengeError) throw challengeError;
  return { factorId: factor.id, challengeId: challenge.id };
}

export async function verifyPhoneChallenge({ factorId, challengeId, code }) {
  const client = getSupabaseClient();
  const { error } = await client.auth.mfa.verify({ factorId, challengeId, code });
  if (error) throw error;
  const { data: level, error: levelError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (levelError) throw levelError;
  if (level.currentLevel !== 'aal2') throw new Error('Verifikasyon SMS la pa fini.');
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw userError || new Error('Sesyon an ekspire.');
  return publicUser(user);
}

export async function signOutAccount() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}
