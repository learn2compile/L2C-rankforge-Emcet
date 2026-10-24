import { config } from '../config.mjs';

async function postProvider(url, token, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Delivery provider returned HTTP ${response.status}`);
}

export async function sendEmail({ to, subject, text, html }) {
  if (!config.emailDeliveryUrl) return { delivered: false, reason: 'not-configured' };
  await postProvider(config.emailDeliveryUrl, config.emailDeliveryToken, { to, subject, text, html });
  return { delivered: true };
}
export async function sendSms({ to, message }) {
  if (!config.smsDeliveryUrl) return { delivered: false, reason: 'not-configured' };
  await postProvider(config.smsDeliveryUrl, config.smsDeliveryToken, { to, message });
  return { delivered: true };
}
export function deliveryStatus() {
  return { email: Boolean(config.emailDeliveryUrl), sms: Boolean(config.smsDeliveryUrl), google: Boolean(config.googleClientId && config.googleClientSecret) };
}
