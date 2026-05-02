import Link from 'next/link'
import { Card } from '@/components/ui/card'

export const metadata = {
  title: 'Guide — BRR AI Training',
  description: 'Learn how to train and deploy brand-certified AI agents with BRR AI.',
}

const STAGES = [
  {
    number: 1,
    title: 'Brand Onboarding',
    description: 'Upload your brand guidelines, tone of voice, and identity documents. The agent learns the foundational rules.',
    duration: 'Day 1–2',
  },
  {
    number: 2,
    title: 'Knowledge Base',
    description: 'Feed product catalogues, FAQs, and support docs. The agent builds its working knowledge of your business.',
    duration: 'Day 3–5',
  },
  {
    number: 3,
    title: 'Scenario Training',
    description: 'Run curated customer conversation scenarios. The agent practices applying brand tone to real situations.',
    duration: 'Day 6–10',
  },
  {
    number: 4,
    title: 'Edge Case Handling',
    description: 'Test escalation flows, sensitive topics, and edge cases. Ensure the agent knows its boundaries.',
    duration: 'Day 11–14',
  },
  {
    number: 5,
    title: 'Stress Testing',
    description: 'High-volume simulation to verify consistency under load. Scores must exceed threshold to advance.',
    duration: 'Day 15–20',
  },
  {
    number: 6,
    title: 'Certification',
    description: 'Final evaluation across all dimensions. On pass, the agent receives its certification and is ready to deploy.',
    duration: 'Day 21',
  },
]

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '🚀',
    steps: [
      {
        step: '1',
        title: 'Create a Brand',
        body: 'Go to Brands → New Brand. Enter the brand name and a short code (e.g. "NK" for Nike). This is the container for all configuration and agents.',
      },
      {
        step: '2',
        title: 'Configure the Brand',
        body: 'Open the brand and fill out the BRR config — tone of voice, target audience, key values, prohibited topics, and escalation triggers.',
      },
      {
        step: '3',
        title: 'Create an Agent',
        body: 'From within the brand, create your first agent. Each agent runs through the full 6-stage training pipeline independently.',
      },
      {
        step: '4',
        title: 'Start Training',
        body: 'Open the agent and click "Start Training" on Stage 1. Work through each stage sequentially — each must be completed before the next unlocks.',
      },
      {
        step: '5',
        title: 'Deploy the Agent',
        body: 'Once all 6 stages are complete the agent is Certified. Click "Deploy Agent" to make it live. Only Deployed or Certified agents can receive chat traffic.',
      },
      {
        step: '6',
        title: 'Connect via API or MCP',
        body: 'Generate an API key from the agent page, then call your agent via REST API or add the MCP server to Claude.ai. See the Integration section below.',
      },
    ],
  },
  {
    id: 'training',
    title: 'Training Pipeline',
    icon: '🎓',
    content: 'stages',
  },
  {
    id: 'organizations',
    title: 'Organizations & Teams',
    icon: '🏢',
    steps: [
      {
        step: '1',
        title: 'Create an Organization',
        body: 'Go to Organizations → New Organization. Give it a name and a unique URL slug. Organizations group members who collaborate on shared brands and agents.',
      },
      {
        step: '2',
        title: 'Invite Members',
        body: 'Open the organization and invite team members by email. Assign roles: Owner, Admin, Member, or Viewer.',
      },
      {
        step: '3',
        title: 'Audit Logs',
        body: 'Every org action is logged. Admins can view the full audit trail under Admin → Audit Logs.',
      },
    ],
  },
  {
    id: 'integration',
    title: 'Integration & API',
    icon: '🔌',
    steps: [
      {
        step: '1',
        title: 'Generate an API Key',
        body: 'Open a deployed agent and scroll to API Keys. Enter a key name (e.g. "Production") and click Generate Key. Copy the key immediately — it is shown only once. You can reveal it again within the same browser session using the Show button.',
      },
      {
        step: '2',
        title: 'Call via REST API',
        body: 'Send a POST request to /api/agents/<agentId>/chat with your message. Include the API key as a Bearer token in the Authorization header. Only Deployed or Certified agents respond.',
        code: `curl -X POST https://your-domain.com/api/agents/<agentId>/chat \\\n  -H "Authorization: Bearer brr_live_<your-key>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"message": "How do I return an item?"}'`,
      },
      {
        step: '3',
        title: 'Connect Claude.ai via MCP',
        body: 'In Claude.ai → Settings → Integrations, add an MCP server. Use your app URL + /api/mcp as the server URL and your API key as the Bearer token when prompted. Claude gains two tools: list_agents and chat_with_agent.',
      },
      {
        step: '4',
        title: 'Revoke Keys',
        body: 'If a key is compromised, click Revoke next to it on the agent page. The key stops working immediately. Generate a new key and update your integrations.',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Plans & Billing',
    icon: '💳',
    steps: [
      {
        step: 'Free',
        title: 'Free Plan',
        body: 'Up to 3 brands and 5 agents. Basic training stages, email support. No credit card required.',
      },
      {
        step: 'Pro',
        title: 'Pro — $29/month',
        body: '20 brands, 50 agents, advanced training, priority support, and team collaboration.',
      },
      {
        step: 'Ent',
        title: 'Enterprise — $99/month',
        body: 'Unlimited brands and agents, custom training pipelines, dedicated support, advanced analytics, and API access.',
      },
    ],
  },
]

function StageCard({ stage }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
        {stage.number}
      </div>
      <div className="pt-1 pb-6 border-b border-slate-100 flex-1 last:border-0 last:pb-0">
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-semibold text-slate-900">{stage.title}</h4>
          <span className="text-xs text-slate-400">{stage.duration}</span>
        </div>
        <p className="text-sm text-slate-600">{stage.description}</p>
      </div>
    </div>
  )
}

function StepCard({ step, title, body, code }) {
  return (
    <div className="flex gap-4 pb-6 last:pb-0">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">
        {step}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-slate-900 mb-1">{title}</h4>
        <p className="text-sm text-slate-600 mb-2">{body}</p>
        {code && (
          <pre className="text-xs bg-slate-900 text-green-400 rounded-lg p-3 overflow-x-auto">{code}</pre>
        )}
      </div>
    </div>
  )
}

export default function PublicGuidePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-slate-900">BRR AI</span>
            <span className="text-slate-400 mx-2">·</span>
            <span className="text-sm text-slate-500">Training System</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm font-medium bg-slate-900 text-white px-4 py-1.5 rounded-lg hover:bg-slate-700"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">How BRR AI Works</h1>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            Train AI agents to represent your brand — consistently, accurately, and at scale.
          </p>
        </div>

        {/* Quick nav */}
        <Card className="p-5 mb-12 bg-white">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">On this page</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`} className="text-sm text-slate-700 hover:text-slate-900 hover:underline">
                {s.icon} {s.title}
              </a>
            ))}
            <a href="#integration" className="text-sm text-slate-700 hover:text-slate-900 hover:underline">🔌 Integration & API</a>
            <a href="#faq" className="text-sm text-slate-700 hover:text-slate-900 hover:underline">❓ FAQ</a>
          </div>
        </Card>

        <div className="space-y-14">
          {SECTIONS.map(section => (
            <section key={section.id} id={section.id}>
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span>{section.icon}</span>
                {section.title}
              </h2>

              {section.content === 'stages' ? (
                <Card className="p-6 bg-white">
                  <p className="text-sm text-slate-600 mb-6">
                    Every agent passes through six sequential stages. A stage must be marked complete before the next unlocks. Failing a stage returns the agent to that stage for remediation.
                  </p>
                  <div className="space-y-0">
                    {STAGES.map(stage => (
                      <StageCard key={stage.number} stage={stage} />
                    ))}
                  </div>
                </Card>
              ) : (
                <Card className="p-6 bg-white divide-y divide-slate-100">
                  {section.steps.map((s, i) => (
                    <div key={i} className={i === 0 ? '' : 'pt-6'}>
                      <StepCard {...s} />
                    </div>
                  ))}
                </Card>
              )}
            </section>
          ))}

          {/* FAQ */}
          <section id="faq">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">❓ FAQ</h2>
            <div className="space-y-4">
              {[
                {
                  q: 'Can I have multiple agents per brand?',
                  a: 'Yes. Each agent trains independently, so you can run A/B variants or have dedicated agents for different channels (chat, voice, email).',
                },
                {
                  q: 'What happens if an agent fails a stage?',
                  a: 'The stage status returns to "In Progress". Review the validation results and test scores, adjust the brand config if needed, then resubmit.',
                },
                {
                  q: 'Can I re-train a certified agent?',
                  a: "Yes. Update your brand config and create a new agent — the original certified agent stays deployed while the new one trains.",
                },
                {
                  q: 'How do I add my team?',
                  a: "Create an Organization, then invite members by email from the Members tab. They'll receive an invite link to join.",
                },
                {
                  q: 'Is my data used to train other models?',
                  a: 'No. Brand configurations and training data are scoped to your account and are never shared or used to train shared models.',
                },
                {
                  q: 'Do I need a credit card to start?',
                  a: 'No. The Free plan supports 3 brands and 5 agents with no payment required.',
                },
              ].map(({ q, a }) => (
                <Card key={q} className="p-5 bg-white">
                  <p className="font-semibold text-slate-900 mb-1">{q}</p>
                  <p className="text-sm text-slate-600">{a}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center py-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Ready to train your first agent?</h2>
            <p className="text-slate-600 mb-6">Start for free — no credit card required.</p>
            <Link
              href="/auth/signup"
              className="inline-block bg-slate-900 text-white font-semibold px-8 py-3 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Get started free
            </Link>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 mt-12 py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} BRR AI Training System
      </footer>
    </div>
  )
}
