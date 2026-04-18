import WebSocket from 'ws';
import { DeepgramClient } from '@deepgram/sdk';
import Anthropic from '@anthropic-ai/sdk';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { systemPrompt } from './system-prompt.js';
import { toolDefinitions, executeTool } from './tools.js';

const CLAUDE_MODEL = 'claude-sonnet-4-5';
// If Arabic quality regresses, revert to eleven_multilingual_v2
const ELEVENLABS_MODEL = 'eleven_flash_v2_5';
const DEEPGRAM_MODEL = 'nova-3';

const APOLOGY_TEXT = "Sorry, I'm having trouble right now. Please call back in a moment. Thank you.";
const IDLE_NUDGE_MS = 25_000;
const IDLE_HANGUP_MS = 40_000;
const TWILIO_FRAME_BYTES = 160;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
const deepgramClient = new DeepgramClient({ key: process.env.DEEPGRAM_API_KEY });

let cachedApologyAudio = null;

(async function cacheApology() {
  try {
    const audio = await elevenlabs.textToSpeech.convert(process.env.ELEVENLABS_VOICE_ID, {
      text: APOLOGY_TEXT,
      modelId: ELEVENLABS_MODEL,
      outputFormat: 'ulaw_8000',
    });
    cachedApologyAudio = await collectToBuffer(audio);
    console.log('Apology audio cached:', cachedApologyAudio.length, 'bytes');
  } catch (err) {
    console.error('Failed to cache apology audio:', err.message);
  }
})();

export async function handleCallSession(twilioWs) {
  let streamSid = null;
  let callSid = null;
  let fromNumber = null;
  let conversationHistory = [];
  let deepgramConnection = null;
  let isResponding = false;
  let nudgeTimer = null;
  let hangupTimer = null;
  let callEnded = false;
  let currentTiming = null;
  let lastSpeakDurationMs = 0;

  const safeLog = (msg, ...args) => {
    const tag = callSid ? callSid.slice(-6) : '?';
    console.log(`[call=${tag}]`, msg, ...args);
  };

  const markTiming = (label, extra = '') => {
    if (!currentTiming) return;
    const now = Date.now();
    const dPrev = now - currentTiming.last;
    const dStart = now - currentTiming.start;
    safeLog(`[+${dPrev}ms / +${dStart}ms total] ${label}${extra ? '  ' + extra : ''}`);
    currentTiming.last = now;
  };

  const sendAudioToTwilio = (audioBuffer) => {
    if (!streamSid || twilioWs.readyState !== WebSocket.OPEN) return;
    let chunkCount = 0;
    for (let i = 0; i < audioBuffer.length; i += TWILIO_FRAME_BYTES) {
      const chunk = audioBuffer.subarray(i, i + TWILIO_FRAME_BYTES);
      if (chunkCount === 0) markTiming('twilio_first_media_sent');
      twilioWs.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: { payload: chunk.toString('base64') },
      }));
      chunkCount++;
    }
    markTiming('twilio_last_media_sent', `${chunkCount} chunks`);
  };

  const speakText = async (text) => {
    if (!text?.trim()) return;
    safeLog('TTS:', text.slice(0, 80));
    markTiming('elevenlabs_request_sent', `text_len=${text.length}`);
    const audio = await elevenlabs.textToSpeech.convert(process.env.ELEVENLABS_VOICE_ID, {
      text,
      modelId: ELEVENLABS_MODEL,
      outputFormat: 'ulaw_8000',
    });
    const buffer = await collectToBuffer(audio);
    markTiming('elevenlabs_audio_received', `${buffer.length} bytes`);
    sendAudioToTwilio(buffer);
  };

  const playApologyAndHangup = async () => {
    if (callEnded) return;
    if (cachedApologyAudio) {
      sendAudioToTwilio(cachedApologyAudio);
      await new Promise((r) => setTimeout(r, 4000));
    }
    closeAll();
  };

  const closeAll = () => {
    if (callEnded) return;
    callEnded = true;
    clearTimeout(nudgeTimer);
    clearTimeout(hangupTimer);
    if (deepgramConnection) {
      try { deepgramConnection.close(); } catch {}
      deepgramConnection = null;
    }
    if (twilioWs.readyState === WebSocket.OPEN) {
      try { twilioWs.close(); } catch {}
    }
    safeLog('CALL ENDED');
    safeLog('TRANSCRIPT:\n' + JSON.stringify(conversationHistory, null, 2));
  };

  const resetIdleTimers = () => {
    clearTimeout(nudgeTimer);
    clearTimeout(hangupTimer);
    nudgeTimer = setTimeout(async () => {
      if (callEnded || isResponding) return;
      try { await speakText('Are you still there?'); } catch {}
      hangupTimer = setTimeout(() => {
        if (!callEnded) {
          safeLog('Idle hangup');
          closeAll();
        }
      }, IDLE_HANGUP_MS - IDLE_NUDGE_MS);
    }, IDLE_NUDGE_MS);
  };

  const handleAssistantTurn = async () => {
    if (isResponding || callEnded) return;
    isResponding = true;
    try {
      while (!callEnded) {
        markTiming('claude_request_sent', `history_len=${conversationHistory.length}`);
        const response = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 200,
          system: systemPrompt,
          tools: toolDefinitions,
          messages: conversationHistory,
        });
        const respTextLen = response.content.filter(b => b.type === 'text').reduce((n, b) => n + b.text.length, 0);
        const respToolCount = response.content.filter(b => b.type === 'tool_use').length;
        markTiming('claude_response_received', `stop=${response.stop_reason}, text=${respTextLen}c, tools=${respToolCount}`);

        conversationHistory.push({ role: 'assistant', content: response.content });

        const textBlocks = response.content.filter((b) => b.type === 'text');
        const toolUses = response.content.filter((b) => b.type === 'tool_use');

        const fullText = textBlocks.map((b) => b.text).join(' ').trim();
        if (fullText) await speakText(fullText);

        if (toolUses.length === 0 || response.stop_reason !== 'tool_use') break;

        const toolResults = [];
        let endCalled = false;
        for (const tu of toolUses) {
          try {
            safeLog('TOOL CALL:', tu.name, JSON.stringify(tu.input));
            markTiming(`tool_${tu.name}_called`);
            const result = await executeTool(tu.name, tu.input, { callSid });
            markTiming(`tool_${tu.name}_result`, 'ok');
            safeLog('TOOL RESULT:', JSON.stringify(result));
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify(result ?? null),
            });
            if (tu.name === 'end_call') endCalled = true;
          } catch (err) {
            safeLog('TOOL ERROR:', tu.name, err.message);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: `Error: ${err.message}`,
              is_error: true,
            });
          }
        }
        conversationHistory.push({ role: 'user', content: toolResults });

        if (endCalled) {
          setTimeout(closeAll, 2000);
          return;
        }
      }
      resetIdleTimers();
    } catch (err) {
      safeLog('ASSISTANT TURN FAILED:', err.message);
      await playApologyAndHangup();
    } finally {
      isResponding = false;
    }
  };

  const openDeepgram = async () => {
    deepgramConnection = await deepgramClient.listen.v1.connect({
      model: DEEPGRAM_MODEL,
      language: 'multi',
      encoding: 'mulaw',
      sample_rate: 8000,
      channels: 1,
      punctuate: true,
      interim_results: true,
      endpointing: 300,
      smart_format: true,
    });

    deepgramConnection.on('open', () => safeLog('Deepgram opened'));
    deepgramConnection.on('error', (err) => {
      safeLog('Deepgram error:', err?.message ?? err);
      playApologyAndHangup();
    });
    deepgramConnection.on('close', () => safeLog('Deepgram closed'));

    deepgramConnection.on('message', async (data) => {
      if (data?.type !== 'Results') return;
      const transcript = data?.channel?.alternatives?.[0]?.transcript ?? '';
      if (!transcript || !data.is_final || !data.speech_final) return;
      const now = Date.now();
      currentTiming = { start: now, last: now };
      safeLog(`turn_start  USER: "${transcript.slice(0, 60)}"`);
      conversationHistory.push({ role: 'user', content: transcript });
      clearTimeout(nudgeTimer);
      clearTimeout(hangupTimer);
      await handleAssistantTurn();
      currentTiming = null;
    });

    deepgramConnection.connect();
    await deepgramConnection.waitForOpen();
  };

  const triggerInitialGreeting = async () => {
    conversationHistory.push({ role: 'user', content: '<call_started>' });
    await handleAssistantTurn();
  };

  twilioWs.on('message', async (msgRaw) => {
    let msg;
    try { msg = JSON.parse(msgRaw.toString()); } catch { return; }

    switch (msg.event) {
      case 'connected':
        safeLog('Twilio WS connected');
        break;
      case 'start':
        streamSid = msg.start.streamSid;
        callSid = msg.start.customParameters?.callSid ?? msg.start.callSid;
        fromNumber = msg.start.customParameters?.from ?? 'unknown';
        safeLog(`Stream started, from=${fromNumber}, streamSid=${streamSid}`);
        try {
          await openDeepgram();
          await triggerInitialGreeting();
        } catch (err) {
          safeLog('Startup failed:', err.message);
          await playApologyAndHangup();
        }
        break;
      case 'media':
        if (msg.media?.payload && deepgramConnection) {
          const audio = Buffer.from(msg.media.payload, 'base64');
          try { deepgramConnection.socket?.send(audio); } catch {}
        }
        break;
      case 'stop':
        safeLog('Twilio stream stopped');
        closeAll();
        break;
    }
  });

  twilioWs.on('close', () => {
    safeLog('Twilio WS closed');
    closeAll();
  });

  twilioWs.on('error', (err) => {
    safeLog('Twilio WS error:', err.message);
    closeAll();
  });
}

async function collectToBuffer(audioResponse) {
  if (Buffer.isBuffer(audioResponse)) return audioResponse;
  if (audioResponse instanceof Uint8Array) return Buffer.from(audioResponse);
  const chunks = [];
  for await (const chunk of audioResponse) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
