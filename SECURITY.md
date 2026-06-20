# Security Policy

## Supported Versions

Only the latest release of `@azversan/mediasoup` receives security updates.

| Version          | Supported |
| ---------------- | --------- |
| `1.x.x` (latest) | ✅        |
| Older versions   | ❌        |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

If you discover a security vulnerability, please report it responsibly by emailing:

📧 **agungmasda29@gmail.com**

Include the following in your report:

- A clear description of the vulnerability
- Steps to reproduce the issue
- Affected versions
- Potential impact assessment
- (Optional) A suggested fix or patch

### What to Expect

- **Acknowledgement** within 48 hours of your report
- **Status update** within 7 days (confirmed, in progress, or rejected with reasoning)
- **Fix and release** as soon as possible, typically within 30 days for critical issues
- **Credit** in the changelog if you wish to be acknowledged (please let us know in your report)

We kindly ask that you avoid publicly disclosing the issue until a fix has been released.

---

## Scope

This policy covers vulnerabilities in the `@azversan/mediasoup` package itself.

**In scope:**

- Insecure default configurations that could expose WebRTC infrastructure
- Issues that allow unauthorized access to mediasoup Workers, Routers, Transports, or Producers/Consumers
- Memory leaks or resource exhaustion vulnerabilities exploitable by a remote attacker
- Dependency vulnerabilities directly introduced by this package

**Out of scope:**

- Vulnerabilities in `mediasoup` core (report to [mediasoup upstream](https://github.com/versatica/mediasoup))
- Vulnerabilities in `@nestjs/*` packages (report to [NestJS](https://github.com/nestjs/nest))
- Issues in user application code consuming this module
- Vulnerabilities requiring physical access to the host machine

---

## Security Best Practices

When using `@azversan/mediasoup`, consider the following recommendations:

### Worker & Transport Configuration

- Always restrict `listenIps` to trusted network interfaces — avoid binding to `0.0.0.0` in production unless behind a firewall or load balancer.
- Use `enabledForDataProducer` and `enabledForDataConsumer` flags carefully to limit unnecessary SCTP exposure.
- Rotate and validate DTLS fingerprints on the client side before establishing transport connections.

### Module Options

- Do not expose `MediasoupService` methods directly as unauthenticated HTTP/WebSocket endpoints. Always validate client identity and RTP capabilities before calling `createConsumer()` or `createProducer()`.
- Validate `rtpCapabilities` received from clients against known-safe codec configurations before passing them to `router.canConsume()`.

### Dependency Management

- Keep `mediasoup`, `@nestjs/common`, and related peer dependencies up to date.
- Regularly audit your dependency tree with `npm audit`.

### Event System

- Be cautious when acting on `@OnMediasoup` events in sensitive flows — events are emitted internally and should not be treated as authenticated inputs.

---

## Disclosure Policy

We follow a **coordinated disclosure** model. Once a fix is released, we will publish a summary of the vulnerability (without technical exploitation details) in the [CHANGELOG](./CHANGELOG.md) and, where appropriate, as a GitHub Security Advisory.
