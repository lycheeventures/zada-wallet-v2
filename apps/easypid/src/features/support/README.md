# In-app support chat

Lets wallet users ask questions and get replies without leaving the app. Backed by a
FreeScout helpdesk with an AI assistant (Eir) that drafts grounded answers; humans review
before sending (or it auto-sends once enabled).

## Architecture

```
Support screen ──HTTPS (X-Wallet-Key)──▶ wallet-support-proxy ──▶ FreeScout ─webhook→ Eir (AI)
  (this feature)                          (holds the FreeScout key)       │
                                                                          ▼ drafts a reply
```

**The wallet never holds the FreeScout API key.** It talks only to a thin server-side proxy
(`wallet-support-proxy`) using a low-value app key. Real credentials, the AI, and ticket
routing all live server-side. Backend + proxy source and full spec:
`openclaw-do/docs/wallet-support-chat.md`.

## Files

| File | Purpose |
|---|---|
| `supportConfig.ts` | Proxy URL + app key from `EXPO_PUBLIC_SUPPORT_*` env |
| `supportIdentity.ts` | Anonymous UUID (MMKV) + optional name/email + local unread tracking |
| `supportDevice.ts` | Device diagnostics (`expo-device` / `expo-application`) |
| `supportApi.ts` | Proxy client (list / messages / send) |
| `useSupportChat.ts` | React-Query hooks (poll + send) |
| `FunkeSupportScreen.tsx` | Home: "New conversation" + previous conversations (bold = unread) |
| `FunkeSupportChatScreen.tsx` | Chat thread (iMessage-style bubbles, polling) |

Routes: `app/(app)/support/index.tsx` + `support/[id].tsx` (registered in `(app)/_layout.tsx`).
Entry point: **Menu → Help & support**.

## Design

- **Identity — no accounts.** A stable UUID is minted on first use (MMKV) and mapped
  server-side to a FreeScout customer. **Name/email are optional** (privacy-first) — if given,
  the team can follow up by email and history survives a reinstall.
- **Device diagnostics** are collected once per new conversation and attached server-side as a
  **hidden internal note** — visible to the support team, never to the customer.
- **Tickets model.** "New conversation" starts a fresh thread (new issue = new ticket);
  previous conversations are listed and reopen on reply. Unread is tracked locally.
- **Replies.** In SAFE mode a human approves each AI draft before it reaches the user; when
  auto-send is enabled server-side, replies appear automatically.

## Env

```
EXPO_PUBLIC_SUPPORT_API_URL=https://support.zada.solutions/wallet-api
EXPO_PUBLIC_SUPPORT_APP_KEY=<X-Wallet-Key from the proxy>
```
Set in `eas.json` (`paradym-preview` profile) for cloud builds and `.env.development` for local
dev. The app key is intentionally low-value — it only permits creating rate-limited support
tickets; the real FreeScout key stays on the proxy.

## Test

`Menu → Help & support → New conversation` → send a message. It creates a real ticket; Eir
drafts a reply that appears here once approved (SAFE mode) or immediately (auto-send).
