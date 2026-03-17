# Temp Test Client

Frontend-only chat client with local chat history, Markdown rendering, and a simple sidebar-based multi-chat UI.

## Live Demo

The project is publicly available here:

- https://abolnikovanton.github.io/temp_test_client/

## Repository Scope

This repository contains only the client application.

- Frontend: this repo
- Backend API: separate neighboring repository

The client sends requests to a remote API endpoint and does not include server-side code.

## Features

- Multiple chats with quick switching
- Chat rename and delete actions
- Export and import chat history as JSON
- Markdown rendering for assistant responses
- Typing indicator
- Estimated token and cost stats
- Automatic long-message chunking
- Optional conversation summarization flow

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Marked (Markdown parser)

## Run Locally

### Option 1: Node.js

```bash
npx serve . -l 5501
```

Open:

- http://localhost:5501

### Option 2: Python

```bash
python -m http.server 5501
```

Open:

- http://localhost:5501

## API Endpoint

The client uses this endpoint in [main.js](main.js):

```js
const serverUrl = "https://temp-test-server-anton-tonic.onrender.com/chat";
```

Update it if your backend URL changes.

## Backend Warm-Up Note

The backend runs on a free hosting plan.

After a period of inactivity, the server may go to sleep. In this case, the first request can take noticeably longer while the service wakes up.

Once the first response is received, the app usually works in normal speed mode.

## Project Structure

```text
.
├─ index.html
├─ main.js
├─ style.css
└─ README.md
```

## Quick Verification

1. Start a local static server.
2. Open the app in your browser.
3. Create a new chat.
4. Send a message.
5. Confirm that a response appears from the API.

## Troubleshooting

1. Send button does nothing

- Open browser DevTools (F12) and check Console for JavaScript errors.
- Verify that the remote API URL is reachable.

2. Network request fails

- Confirm backend availability.
- Check CORS and HTTPS setup on the backend side.

3. Blank or broken page

- Run through a local server, not by opening the HTML file directly.
