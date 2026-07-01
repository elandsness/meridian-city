import Card from '../../ui/Card.jsx'
import Button from '../../ui/Button.jsx'
import { useConfig } from '../../config/ConfigContext'

// Home entry point to the passenger journey tracker.
export default function MyJourneyCard() {
  const cfg = useConfig()
  return (
    <Card title="Your journey">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600 max-w-md">
          Follow your trip through {cfg.company.name} — check-in, security, and boarding, tracked step by step.
        </p>
        <Button to="/my-journey" variant="primary" size="sm">View journey</Button>
      </div>
    </Card>
  )
}
