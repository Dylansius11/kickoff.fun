---
name: Privy
description: Use when building authentication systems, embedded wallets, wallet controls, transaction signing, user management, or wallet infrastructure for web3 applications. Reach for this skill when implementing user onboarding, creating self-custodial or custodial wallets, setting transaction policies, managing wallet access controls, or integrating blockchain transactions.
metadata:
    mintlify-proj: privy
    version: "1.0"
---

# Privy Skill Reference

## Product summary

Privy is a wallet infrastructure and authentication platform that enables developers to embed wallets and user authentication directly into applications. It provides three interconnected layers: authentication (email, social, passkey, wallet-based), wallet infrastructure (embedded wallets across 50+ blockchains, external wallet connectors, digital asset accounts), and controls (owners, signers, policies). 

**Key files and configuration:**
- Dashboard: https://dashboard.privy.io (manage apps, users, wallets, policies)
- App ID and App Secret: Found in Dashboard > App Settings > Basics
- REST API base: `https://api.privy.io/v1`
- Client SDKs: React (`@privy-io/react-auth`), React Native (`@privy-io/expo`), Node.js, Java, Go, Rust, Ruby, Swift, Android, Flutter, Unity
- Primary docs: https://docs.privy.io

## When to use

Reach for Privy when:
- Building user authentication (email, SMS, social, passkey, wallet-based, OAuth)
- Creating embedded wallets for users or applications
- Implementing wallet controls (owners, signers, policies)
- Signing transactions on Ethereum, Solana, or 50+ other blockchains
- Managing user accounts and wallet lifecycle
- Setting transaction limits, recipient allowlists, or smart contract restrictions
- Integrating external wallets (MetaMask, Phantom, etc.)
- Building custodial or self-custodial wallet systems
- Handling multi-factor authentication or biometric verification
- Tracking wallet events via webhooks

## Quick reference

### Authentication methods
| Method | Use case | Setup |
|--------|----------|-------|
| Email/SMS | Passwordless login | Enable in Dashboard > Login Methods |
| Social (Google, Discord, Twitter, etc.) | Web2 identity | Configure OAuth in Dashboard |
| Wallet (MetaMask, Phantom) | Crypto-native users | Enable in Dashboard > Login Methods |
| Passkey | Biometric/hardware key | Enable in Dashboard > Login Methods |
| Custom OAuth | Existing auth provider | Register JWKS endpoint in Dashboard |
| JWT-based | Your own auth system | Configure in Dashboard > Authentication |

### Wallet types
| Type | Control | Best for | Key feature |
|------|---------|----------|-------------|
| Embedded | User or app | Consumer apps, onboarding | Privy manages keys in TEEs |
| External | User | Power users | User brings existing wallet |
| Digital Asset Account | User or app | Multi-chain fintech | Abstraction over multiple wallets |
| Custodial | Licensed custodian | Regulated entities | Third-party operates wallet |

### SDK setup patterns
**React:**
```tsx
<PrivyProvider appId="your-app-id" clientId="your-client-id" config={{embeddedWallets: {ethereum: {createOnLogin: 'users-without-wallets'}}}}>
  {children}
</PrivyProvider>
```

**Node.js:**
```ts
const privy = new PrivyClient({appId: 'your-app-id', appSecret: 'your-app-secret'});
```

**REST API:**
```bash
curl -u "app-id:app-secret" -H "privy-app-id: app-id" https://api.privy.io/v1/wallets
```

### Common API endpoints
| Task | Endpoint | Method |
|------|----------|--------|
| Create wallet | `/v1/wallets` | POST |
| Get wallet | `/v1/wallets/{id}` | GET |
| Create user | `/v1/users` | POST |
| Get user | `/v1/users/{id}` | GET |
| Create policy | `/v1/policies` | POST |
| Sign transaction | `/v1/wallets/{id}/rpc` | POST |
| Get balance | `/v1/wallets/{id}/balance` | GET |

## Decision guidance

### When to use embedded vs external wallets
| Scenario | Embedded | External |
|----------|----------|----------|
| New users without crypto experience | ✓ | ✗ |
| Users with existing wallets | ✗ | ✓ |
| Need full control over key management | ✓ | ✗ |
| User brings their own assets | ✗ | ✓ |
| Seamless onboarding UX | ✓ | ✗ |
| Power users, DeFi traders | ✗ | ✓ |

### When to use Privy auth vs JWT-based auth
| Scenario | Privy auth | JWT-based |
|----------|-----------|-----------|
| No existing auth system | ✓ | ✗ |
| Multiple login methods needed | ✓ | ✓ |
| Already have Auth0/Firebase/Cognito | ✗ | ✓ |
| Want Privy to manage everything | ✓ | ✗ |
| Integrating with existing backend | ✗ | ✓ |

### Wallet ownership models
| Model | Owner | Use case | Control |
|-------|-------|----------|---------|
| User-owned | User | Self-custodial consumer wallets | User has all keys |
| User + server | User | Automated trading, limit orders | User retains ownership, server has scoped permissions |
| App-owned | Authorization key | Treasury, bots, agents | App backend controls via API |
| Custodial | Licensed custodian | Regulated entities | Custodian operates on behalf of user |

## Workflow

### 1. Set up your Privy app
- Create organization at https://dashboard.privy.io
- Create app and obtain App ID and App Secret
- Configure login methods in Dashboard > Login Methods
- Set up app clients for different environments if needed

### 2. Implement authentication
- For React: Wrap app with `PrivyProvider`, use `usePrivy()` hook to access auth state
- For Node.js: Initialize `PrivyClient` with app credentials
- For REST API: Include Basic Auth header with app ID:secret and `privy-app-id` header
- Check `ready` state before consuming Privy state

### 3. Create or retrieve users
- Client-side: User auto-created on first login via PrivyProvider
- Server-side: Call `POST /v1/users` with linked accounts and metadata
- Retrieve user: Call `GET /v1/users/{id}` or search by email/wallet/social

### 4. Create wallets
- Client-side: Call `createWallet()` from `useCreateWallet()` hook or configure `createOnLogin`
- Server-side: Call `POST /v1/wallets` with owner (user ID or authorization key) and chain type
- Specify owner: User ID for self-custodial, authorization key for app-controlled
- Attach policies at creation time if needed

### 5. Set up policies (optional)
- Define rules for transaction limits, recipient allowlists, contract restrictions
- Create via Dashboard, Node.js SDK, or REST API
- Attach to wallet at creation or update wallet with policy IDs
- Policies evaluated in secure enclaves before transaction execution

### 6. Sign transactions
- Client-side: Use chain-specific hooks (`useSignTransaction`, `useSignMessage`, etc.)
- Server-side: Call `/v1/wallets/{id}/rpc` with method and params
- For user-owned wallets: Request user key with access token, sign request with user key
- For app-owned wallets: Sign request with authorization key

### 7. Monitor wallet activity
- Set up webhooks in Dashboard > Webhooks
- Subscribe to events: user.created, wallet.funds_deposited, transaction.confirmed, etc.
- Handle webhook payloads and update app state
- Verify webhook signatures using app secret

## Common gotchas

- **Forgetting to wait for `ready`**: Always check `usePrivy().ready` before consuming Privy state; initialization may still be in progress
- **Missing policy rules**: If a wallet has a policy, it must include rules for every RPC method the wallet will use; missing methods default to DENY
- **User key expiry**: User keys are time-bound; request new keys when they expire; don't cache indefinitely
- **Authorization key signatures**: Server-side wallet operations require signing requests with authorization keys; use the correct key for the resource
- **Chain type mismatch**: Wallet chain type must match the transaction chain; can't send Ethereum transaction on Solana wallet
- **Policy evaluation order**: DENY rules take precedence over ALLOW; if any rule denies, request is denied
- **Idempotency keys**: Use idempotency keys for wallet creation and critical operations to prevent duplicates on retries
- **Rate limits**: Wallet creation endpoints are rate-limited; implement exponential backoff for retries
- **External wallet setup**: For Solana external wallets, must pass `toSolanaWalletConnectors()` to `externalWallets` config
- **Webhook testing**: Webhooks are free to test in development; production requires Enterprise plan
- **App client IDs**: Use app clients to customize Privy behavior for different domains/environments; configure in Dashboard

## Verification checklist

Before submitting work with Privy:

- [ ] App ID and App Secret are stored securely (environment variables, not hardcoded)
- [ ] PrivyProvider wraps the entire app and `ready` state is checked before using Privy
- [ ] Authentication method is configured in Dashboard and matches implementation
- [ ] Wallets are created with correct owner (user ID for self-custodial, auth key for app-controlled)
- [ ] Policies are attached to wallets if transaction restrictions are needed
- [ ] All RPC methods used by wallet have corresponding policy rules (if policy exists)
- [ ] User keys are requested with valid access tokens and decrypted correctly
- [ ] Authorization keys are used to sign server-side requests for app-owned wallets
- [ ] Webhook endpoints are registered and signatures are verified
- [ ] Error handling covers common cases (policy violations, insufficient funds, expired tokens)
- [ ] Rate limiting is handled with exponential backoff
- [ ] Chain types match between wallet and transaction
- [ ] Idempotency keys are used for critical operations

## Resources

**Comprehensive navigation:** https://docs.privy.io/llms.txt

**Critical documentation pages:**
- [About Privy](https://docs.privy.io/basics/get-started/about) — Core concepts and engineering principles
- [Key Concepts](https://docs.privy.io/basics/key-concepts) — Authentication, wallets, controls, and wallet models
- [API Reference](https://docs.privy.io/api-reference/introduction) — Complete REST API documentation with authentication details

---

> For additional documentation and navigation, see: https://docs.privy.io/llms.txt