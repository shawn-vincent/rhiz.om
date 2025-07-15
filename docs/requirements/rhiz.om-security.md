# Rhiz.om Security Requirements (v 2025-07-12)

---

## 0 · Guiding Principles

> **Secure by default, explicit by design.**
> We adopt a zero-trust security model, where every component and action is untrusted until explicitly verified. This document outlines the security requirements for the Rhiz.om platform, covering code-level, infrastructure, and deployment best practices.

---

## 1 · Code-Level Security

### 1.1 · Deno Runtime

*   **Permissions:** Deno's permission model is a cornerstone of our security strategy. All Deno processes must be executed with the minimum required permissions.
    *   `--allow-net`: Must be scoped to specific domains (e.g., `deno run --allow-net=api.cloudflare.com,auth0.com ...`).
    *   `--allow-read` / `--allow-write`: Must be scoped to specific directories.
    *   `--allow-env`: Must be used judiciously, only exposing necessary environment variables.
    *   `--allow-run`: Must be avoided whenever possible.
*   **Dependency Management:**
    *   **Lock File:** A `deno.lock` file must be used to ensure dependency integrity. The `--locked` flag should be used in CI/CD pipelines to prevent unexpected changes.
    *   **Auditing:** Dependencies must be regularly audited for vulnerabilities using `deno lint` and third-party tools.
*   **Secure Coding:**
    *   **Input Sanitization:** All user input must be sanitized to prevent XSS, SQL injection, and other injection attacks.
    *   **Unsafe APIs:** Avoid using `Deno.UnsafePointer` and other unsafe APIs.

### 1.2 · React Frontend

*   **Cross-Site Scripting (XSS) Prevention:**
    *   **`dangerouslySetInnerHTML`:** This prop must be avoided. If its use is absolutely necessary, the input must be sanitized using a library like DOMPurify.
    *   **URL Validation:** All URLs must be validated to ensure they are `http:` or `https:`.
*   **Component Security:**
    *   **Third-Party Libraries:** All third-party React components must be vetted for security vulnerabilities.
    *   **Direct DOM Access:** Avoid direct DOM manipulation using `refs` or `findDOMNode()`.

### 1.3 · General Best Practices

*   **OWASP Top 10:** All code must be written to mitigate the risks outlined in the [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x00-header/) and the [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/).
*   **Secrets Management:** No secrets (API keys, tokens, etc.) shall be hardcoded in the source code. All secrets must be stored securely in environment variables or a dedicated secrets management service.

---

## 2 · Infrastructure & Configuration Security

### 2.1 · Cloudflare Workers

*   **Isolation:** We rely on Cloudflare's V8 Isolate technology to provide strong security boundaries between different workers.
*   **Secrets:** All secrets used by Cloudflare Workers must be managed through the Workers secrets vault.
*   **Firewall:** Cloudflare WAF must be enabled and configured to block common web attacks.

### 2.2 · Auth0

*   **Tenant Configuration:**
    *   **Separate Tenants:** Separate Auth0 tenants must be used for development, staging, and production environments.
    *   **Custom Domains:** A custom domain must be used for the Auth0 tenant.
*   **Authentication:**
    *   **MFA:** Multi-factor authentication must be enforced for all users.
    *   **Password Policies:** A strong password policy must be enforced.
    *   **Brute-force Protection:** Auth0's brute-force protection must be enabled.
*   **Token Handling:**
    *   **Token Storage:** Access tokens must be stored in memory. Refresh tokens must be stored in `HttpOnly` cookies.
    *   **Token Expiration:** Access tokens must have a short expiration time (e.g., 15 minutes). Refresh tokens must be rotated.

### 2.3 · Deno KV & Cloudflare R2

*   **Access Control:** Access to Deno KV and R2 must be restricted to authorized Cloudflare Workers.
*   **Data Encryption:** All data stored in Deno KV and R2 must be encrypted at rest.

---

## 3 · Deployment & Operational Security

### 3.1 · CI/CD Pipeline

*   **Static Analysis:** The CI/CD pipeline must include static application security testing (SAST) to identify vulnerabilities in the source code.
*   **Dependency Scanning:** The CI/CD pipeline must include dependency scanning to identify vulnerabilities in third-party libraries.
*   **Secrets Scanning:** The CI/CD pipeline must include secrets scanning to prevent secrets from being committed to the repository.

### 3.2 · Monitoring & Logging

*   **Audit Logs:** All security-related events must be logged to an immutable audit log.
*   **Alerting:** Alerts must be configured to notify the security team of any suspicious activity.

### 3.3 · Incident Response

*   **Incident Response Plan:** A formal incident response plan must be in place to address security incidents.
*   **Regular Drills:** The incident response plan must be tested regularly through drills and simulations.

---

## 4 · Security Review & Sign-off

All code, infrastructure, and configuration changes must be reviewed and approved by the security team before being deployed to production.
