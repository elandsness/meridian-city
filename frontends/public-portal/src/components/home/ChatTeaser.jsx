import { Link } from 'react-router-dom'
import { useConfig } from '../../config/ConfigContext'
import Card from '../../ui/Card.jsx'
import Button from '../../ui/Button.jsx'

export default function ChatTeaser() {
  const cfg = useConfig()
  const assistantName = cfg.company?.assistant?.name ?? 'Meridian Assistant'

  return (
    <Card
      className="border-0"
      bodyClassName="!p-0"
    >
      <div
        className="rounded-2xl px-6 py-5 flex items-center justify-between gap-4"
        style={{ background: 'color-mix(in srgb, var(--brand) 8%, white)' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shrink-0"
            style={{ background: 'var(--brand)' }}
          >
            💬
          </div>
          <div>
            <div className="font-semibold text-slate-900">{assistantName}</div>
            <div className="text-sm text-slate-500">Ask me anything about city services</div>
          </div>
        </div>
        <Button to="/messages" variant="primary" size="sm" className="shrink-0">
          Chat now →
        </Button>
      </div>
    </Card>
  )
}
