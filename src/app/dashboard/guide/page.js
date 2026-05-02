import Link from 'next/link'
import { Card } from '@/components/ui/card'

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
        link: '/dashboard/brands',
        linkLabel: 'Go to Brands',
      },
      {
        step: '2',
        title: 'Configure the Brand',
        body: 'Open the brand and fill out the BRR config — tone of voice, target audience, key values, prohibited topics, and escalation triggers. This configuration drives every training stage.',
      },
      {
        step: '3',
        title: 'Create an Agent',
        body: 'From within the brand, create your first agent. Each agent runs through the full 6-stage training pipeline independently, so you can run multiple agents per brand.',
      },
      {
        step: '4',
        title: 'Start Training',
        body: 'Open the agent and click "Start Training" on Stage 1. Work through each stage sequentially — each must be completed before the next unlocks.',
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
        link: '/dashboard/organizations',
        linkLabel: 'Go to Organizations',
      },
      {
        step: '2',
        title: 'Invite Members',
        body: 'Open the organization and invite team members by email. Assign roles: Owner, Admin, Member, or Viewer. Admins can invite and remove members; Viewers can only read.',
      },
      {
        step: '3',
        title: 'Audit Logs',
        body: 'Every org action (invites, role changes, updates) is logged. Admins can view the full audit trail under Admin → Audit Logs.',
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
        body: '20 brands, 50 agents, advanced training, priority support, and team collaboration. Ideal for growing teams.',
      },
      {
        step: 'Ent',
        title: 'Enterprise — $99/month',
        body: 'Unlimited brands and agents, custom training pipelines, dedicated support, advanced analytics, and API access.',
        link: '/dashboard/billing',
        linkLabel: 'View Plans',
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
      <div className="pt-1 pb-6 border-b border-slate-100 flex-1">
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-semibold text-slate-900">{stage.title}</h4>
          <span className="text-xs text-slate-400">{stage.duration}</span>
        </div>
        <p className="text-sm text-slate-600">{stage.description}</p>
      </div>
    </div>
  )
}

function StepCard({ step, title, body, link, linkLabel }) {
  return (
    <div className="flex gap-4 pb-6 last:pb-0">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">
        {step}
      </div>
      <div>
        <h4 className="font-semibold text-slate-900 mb-1">{title}</h4>
        <p className="text-sm text-slate-600 mb-2">{body}</p>
        {link && (
          <Link href={link} className="text-xs font-medium text-slate-900 underline underline-offset-2 hover:text-slate-600">
            {linkLabel} →
          </Link>
        )}
      </div>
    </div>
  )
}

export default function GuidePage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900">Guide</h1>
        <p className="text-slate-600 mt-2">Everything you need to train and deploy brand-certified AI agents</p>
      </div>

      {/* Quick nav */}
      <Card className="p-5 mb-10 bg-slate-50">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">On this page</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`} className="text-sm text-slate-700 hover:text-slate-900 hover:underline">
              {s.icon} {s.title}
            </a>
          ))}
        </div>
      </Card>

      <div className="space-y-12">
        {SECTIONS.map(section => (
          <section key={section.id} id={section.id}>
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span>{section.icon}</span>
              {section.title}
            </h2>

            {section.content === 'stages' ? (
              <Card className="p-6">
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
              <Card className="p-6 divide-y divide-slate-100">
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
          <h2 className="text-xl font-bold text-slate-900 mb-6">❓ FAQ</h2>
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
                a: 'Yes. Update your brand config and create a new agent — the original certified agent stays deployed while the new one trains.',
              },
              {
                q: 'How do I add my team?',
                a: 'Create an Organization, then invite members by email from the Members tab. They\'ll receive an invite link to join.',
              },
              {
                q: 'Is my data used to train other models?',
                a: 'No. Brand configurations and training data are scoped to your account and are never shared or used to train shared models.',
              },
            ].map(({ q, a }) => (
              <Card key={q} className="p-5">
                <p className="font-semibold text-slate-900 mb-1">{q}</p>
                <p className="text-sm text-slate-600">{a}</p>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
