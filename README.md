# Temp Test Client

Client-side chat app (ChatGPT-style UI) built with plain JavaScript.

## Live Demo

https://abolnikovanton.github.io/temp_test_client/

## Scope Of This Repository

This repository contains only the frontend client.

- UI, chat logic, local persistence, Markdown rendering
- No backend code in this repo
- Backend API is hosted in a separate neighboring repository

## What It Does

- Multi-chat support with localStorage persistence
- Rename / delete chats
- Export and import chat history as JSON
- Send messages to remote API endpoint
- Render assistant replies as Markdown
- Sanitize Markdown HTML output with DOMPurify
- Split very long user messages into chunks automatically
- Rolling conversation summary for long chats
- Token estimation and cost tracking in UI
- Typing indicator and Enter-to-send behavior

## API Endpoint

Configured in [main.js](main.js):

```js
const serverUrl = "https://temp-test-server-anton-tonic.onrender.com/chat";
```

## Backend Warm-Up Note

The backend runs on a free hosting plan.

After idle time, the service may sleep. The first request can be slower while the server wakes up.

Once warmed up, responses should return at normal speed.

## Project Files

```text
.
├─ index.html
├─ main.js
├─ style.css
└─ README.md
```

## Local Run (Optional)

The app is publicly available via GitHub Pages, so local run is optional.

If you still want to run it locally, use any static file server, for example:

```bash
npx serve . -l 5501
```

Then open `http://localhost:5501`.

## Troubleshooting

1. Send button appears to do nothing

- Open DevTools Console (F12) and check for JS errors.
- Verify network requests are sent to `/chat`.

2. API returns server error

- Check backend logs in the backend repository/deploy.
- Re-check backend environment variables (OpenAI key, model, etc.).

3. First response is slow

- Expected on free hosting after inactivity (cold start).
