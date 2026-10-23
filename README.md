# Sudo Game

A simple 4-player party game built as a static web app. It keeps each player's score in browser local storage so the scoreboard persists between refreshes.

## Features

- 4-player setup with custom names
- Fast math challenge rounds
- Turn-based play for all four friends
- Timer and scoring
- Local storage persistence
- Easy to embed in a chat app via iframe or webview

## Run locally

From this folder:

```bash
python3 -m http.server 8000
```

Then open: http://localhost:8000

## Arattai Share App

Host the folder on an `https://` URL and add that URL as a Share app shortcut in Arattai.

- `theme` (`light`/`dark`) and `language` URL params are applied on load.
- The `chat_context` message keys scores per chat (hashed chat id) in `localStorage`.
- "Share scores" puts a text summary in the chat composer; "Invite to chat" sends a Visit invite card. Both are only shown when the game runs inside the Arattai iframe, and the user must press Send.

## Notes

- Scores are stored in the browser using `localStorage`.
- Scores are local to each device; players share one device per match.
