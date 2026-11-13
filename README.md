# jarvis-whatsapp-relay

A tiny zero-dependency Node server that relays Twilio WhatsApp webhook messages (POST /whatsapp) to a Dify chat agent and replies with TwiML. Set the environment variable `DIFY_API_KEY` (required) and optionally `DIFY_BASE_URL` (defaults to https://api.dify.ai/v1). Start it with `npm start`.
