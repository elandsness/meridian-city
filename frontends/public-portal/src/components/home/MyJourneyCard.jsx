import { useConfig } from '../../config/ConfigContext'
import { useNavigate } from 'react-router-dom'
import Card from '../../ui/Card.jsx'
import Button from '../../ui/Button.jsx'

export default function MyJourneyCard() {
  const cfg = useConfig()
  const navigate = useNavigate()

  // Find the journey screen path from the config if possible
  const journeyScreen = cfg?.screens?.public?.find(s => s.template === 'entity-journey')
  const journeyPath = journeyScreen ? `/${journeyScreen.id}` : '/my-journey'

  return (
    <Card title="Your journey">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600 max-w-md">
          Follow your trip through {cfg.company.name} — check-in, security, and boarding, tracked step by step.
        </p>
        <Button to={journeyPath} variant="primary" size="sm">View journey</Button>
      </div>
    </Card>
  )
}
