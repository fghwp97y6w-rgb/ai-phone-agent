import twilio from 'twilio';

const { VoiceResponse } = twilio.twiml;

export function buildStreamTwiml({ publicUrl, callSid, fromNumber }) {
  if (!publicUrl) {
    throw new Error('PUBLIC_URL env var is not set — cannot build TwiML stream URL');
  }

  const wsUrl = publicUrl.replace(/^https?:\/\//, 'wss://').replace(/\/$/, '') + '/media-stream';

  const response = new VoiceResponse();
  const connect = response.connect();
  const stream = connect.stream({ url: wsUrl });
  stream.parameter({ name: 'callSid', value: callSid });
  stream.parameter({ name: 'from', value: fromNumber });

  return response.toString();
}
