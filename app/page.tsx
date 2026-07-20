import Link from "next/link";

import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    title: "Bring your own key",
    description:
      "Connect any OpenAI-compatible endpoint and model — your key is encrypted at rest and never sent back to the browser.",
  },
  {
    title: "Research, not just chat",
    description:
      "The agent decides when to search the web, cites its sources, and keeps reasoning until it has a real answer.",
  },
  {
    title: "PDF reports on demand",
    description:
      "Ask for a report and get a downloadable PDF with sections and references, generated from the conversation.",
  },
  {
    title: "Full usage transparency",
    description:
      "Every request logs prompt, completion, and cache tokens, plus an estimated cost — visible on your usage dashboard.",
  },
];

const FAQS = [
  {
    question: 'What does "bring your own key" (BYOK) mean?',
    answer:
      "You configure your own OpenAI-compatible API endpoint and key in Settings. MicroManus never holds or bills for LLM usage — your provider bills you directly.",
  },
  {
    question: "What models are supported?",
    answer:
      "Any OpenAI-compatible chat completions endpoint — OpenAI, Anthropic and others via a compatible gateway, Kimi, self-hosted models, and more.",
  },
  {
    question: "Is my API key safe?",
    answer:
      "Yes. It's encrypted (AES-256-GCM) before it's stored, and only ever decrypted server-side to make a request on your behalf. It's never returned to the browser.",
  },
  {
    question: "What happens to my credits?",
    answer:
      "Unlocking gives you 5 credits. Each research prompt uses exactly 1 credit, no matter how many searches or reasoning steps the agent takes to answer it.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          AI research that shows its work
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg">
          MicroManus is a research agent that searches the web, cites its
          sources, and can turn its findings into a PDF report — using your own
          API key.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" render={<Link href="/login">Get started</Link>} />
        </div>
      </section>

      {/* Features */}
      <section className="border-t px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-2xl font-semibold">Features</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-lg border p-6">
                <h3 className="mb-2 font-medium">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t px-6 py-20">
        <div className="mx-auto max-w-md text-center">
          <h2 className="mb-4 text-2xl font-semibold">Pricing</h2>
          <p className="text-muted-foreground mb-6">
            Unlock 5 credits with the coupon code{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 text-sm">
              SID_DRDROID
            </code>
            . Card payment is coming soon.
          </p>
          <Button
            variant="outline"
            render={<Link href="/login">Unlock access</Link>}
          />
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t px-6 py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-10 text-center text-2xl font-semibold">FAQ</h2>
          <div className="flex flex-col gap-6">
            {FAQS.map((faq) => (
              <div key={faq.question}>
                <h3 className="mb-1 font-medium">{faq.question}</h3>
                <p className="text-muted-foreground text-sm">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t px-6 py-20">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-semibold">Ready to try it?</h2>
          <p className="text-muted-foreground">
            Sign in with Google or GitHub and unlock access in under a minute.
          </p>
          <Button size="lg" render={<Link href="/login">Get started</Link>} />
        </div>
      </section>
    </div>
  );
}
