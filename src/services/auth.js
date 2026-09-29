import { getSupabaseClient } from './supabase';

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.user_metadata?.firstName || '',
    name: user.user_metadata?.name || '',
    countryCode: user.user_metadata?.countryCode || '',
    phoneNumber: user.user_metadata?.phoneNumber || user.user_metadata?.phone || '',
  };
}

export async function requestEmailCode(email, { createUser = false, profile = {} } = {}) {
  const { error } = await getSupabaseClient().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: createUser,
      ...(createUser ? { data: profile } : {}),
    },
  });
  if (error) {
    // Surface the server code for diagnosis without logging email addresses or tokens.
    console.warn('Save Me OTP request:', { signup: createUser, code: error.code, status: error.status });
    throw new Error(`${error.message}${error.code ? ` (${error.code})` : ''}`);
  }
}

export async function verifyEmailCode(email, code) {
  const { data, error } = await getSupabaseClient().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  });
  if (error) throw error;
  if (!data.session || !data.user) throw new Error('Sesyon an pa ouvri. Eseye ankò.');
  return publicUser(data.user);
}

export async function signOutAccount() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}
