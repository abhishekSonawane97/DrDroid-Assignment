# MicroManus - Engineering Blueprint

> **Project Status:** Development Started\
> **Owner:** Abhishek Sonawane\
> **Purpose:** This document is the single source of truth for
> implementation. Coding agents should follow this specification unless
> a newer version supersedes it.

------------------------------------------------------------------------

# 1. Objective

Build a production-ready AI research platform named **MicroManus**.

The platform allows users to: - Authenticate with Google/GitHub. -
Unlock access using either Stripe payment (\$5) or coupon
`SID_DRDROID`. - Receive 5 credits. - Add their own OpenAI-compatible
API endpoint and API key. - Select AI models. - Chat with a deep
research agent. - Run multi-step agent reasoning with web search. -
Generate PDF reports. - Track token usage and costs. - View analytics
for every conversation.

Goal is **working functionality**, not feature quantity.

------------------------------------------------------------------------

# 2. Guiding Principles

1.  Ship reliable software.
2.  Every feature must be testable.
3.  Prefer simplicity over cleverness.
4.  No mocked core flows.
5.  Mobile responsive.
6.  Fast first paint.
7.  Production deployment only.

------------------------------------------------------------------------

# 3. Technology Stack

## Frontend

-   Next.js (App Router)
-   React
-   TypeScript
-   Tailwind CSS
-   shadcn/ui

## Backend

-   Next.js Route Handlers
-   Supabase
-   PostgreSQL
-   Drizzle ORM or Prisma

## Authentication

-   Supabase Auth
-   Google OAuth
-   GitHub OAuth

## Payments

-   Stripe Checkout
-   Stripe Webhooks

## AI

-   OpenAI Compatible SDK
-   Claude
-   GPT
-   Kimi
-   Configurable Base URL

## Search

-   Brave Search or
-   Serper API

## PDF

-   react-pdf or pdf-lib

## Hosting

-   Vercel

------------------------------------------------------------------------

# 4. Pages

## Landing

Purpose: Explain product.

Sections: - Hero - Features - Pricing - FAQ - CTA

------------------------------------------------------------------------

## Authentication

Only: - Continue with Google - Continue with GitHub

No email/password.

------------------------------------------------------------------------

## Paywall

Two options:

Option A Coupon: SID_DRDROID

Option B

Stripe

Successful unlock: +5 credits.

------------------------------------------------------------------------

## Dashboard

Sidebar

-   Chats
-   Usage
-   API Keys
-   Settings

------------------------------------------------------------------------

## Chat

Requirements

-   Thread list
-   New chat
-   Rename chat
-   Delete chat

Chat supports

-   markdown
-   code blocks
-   streaming
-   artifacts

------------------------------------------------------------------------

## Usage

Charts

Show

-   input tokens
-   output tokens
-   cache tokens
-   total cost
-   total requests
-   model usage

------------------------------------------------------------------------

# 5. Agent Loop

Every prompt executes

Think

↓

Search

↓

Reason

↓

Search Again (optional)

↓

Reason

↓

Generate Final Answer

↓

Generate PDF if requested

Agent continues until completion or max iteration count.

------------------------------------------------------------------------

# 6. Conversation Memory

Memory exists only inside a thread.

Switching thread loads previous messages.

New thread starts empty.

------------------------------------------------------------------------

# 7. Database

users

-   id
-   email
-   provider
-   credits

chat_threads

-   id
-   user_id
-   title

messages

-   id
-   thread_id
-   role
-   content
-   tokens

artifacts

-   id
-   thread_id
-   pdf_url

api_keys

-   encrypted_key
-   endpoint
-   selected_model

usage_logs

-   prompt_tokens
-   completion_tokens
-   cache_tokens
-   calculated_cost

payments

-   stripe_session
-   amount

------------------------------------------------------------------------

# 8. Credits

Signup

↓

Locked

↓

Coupon OR Payment

↓

Credits = 5

Each request

↓

Estimate cost

↓

Reject if credits exhausted

------------------------------------------------------------------------

# 9. Cost Engine

Store pricing table.

Never hardcode into UI.

Fields

-   input price
-   output price
-   cache read
-   cache write

Cost formula

Input Cost + Output Cost + Cache Cost

Persist every request.

------------------------------------------------------------------------

# 10. Cache

Hash

(system prompt + messages + model)

If exists

Return cached response.

Otherwise

Call provider.

Store response.

------------------------------------------------------------------------

# 11. API Settings

User provides

Endpoint

API Key

Model

Validate

Save encrypted.

Never expose.

------------------------------------------------------------------------

# 12. PDF

Generate professional report.

Include

Title

Sections

References

Timestamp

Conversation metadata

------------------------------------------------------------------------

# 13. Error Handling

Expired API key

Network timeout

Provider unavailable

Invalid model

Insufficient credits

Friendly UI only.

------------------------------------------------------------------------

# 14. Security

Encrypt API keys.

Server-side execution only.

No secrets in browser.

Use RLS in Supabase.

------------------------------------------------------------------------

# 15. Folder Structure

``` text
app/
components/
features/
lib/
actions/
db/
types/
hooks/
providers/
```

------------------------------------------------------------------------

# 16. API Endpoints

POST /api/chat

POST /api/search

POST /api/report

POST /api/payment

POST /api/coupon

GET /api/usage

GET /api/models

POST /api/settings

------------------------------------------------------------------------

# 17. Milestones

Phase 1

Authentication

Phase 2

Paywall

Phase 3

Chat

Phase 4

Agent

Phase 5

PDF

Phase 6

Usage Dashboard

Phase 7

Testing

Phase 8

Deployment

------------------------------------------------------------------------

# 18. Acceptance Criteria

✓ Google login

✓ GitHub login

✓ Stripe payment

✓ Coupon unlock

✓ Credits

✓ Agent

✓ Context memory

✓ Multiple chats

✓ PDF

✓ Usage dashboard

✓ OpenAI-compatible endpoint

✓ Multiple providers

✓ Production deployment

------------------------------------------------------------------------

# 19. Deliberately Out of Scope

-   Team workspaces
-   Sharing chats
-   Vector database
-   Long-term memory
-   Mobile app
-   Voice mode
-   Image generation

------------------------------------------------------------------------

# 20. Final Goal

This project should demonstrate:

-   Product thinking
-   Full-stack engineering
-   AI integration
-   Production readiness
-   Clean UX
-   Reliable deployment

If a reviewer signs up without documentation, they should naturally
discover every feature and successfully complete the full flow.
