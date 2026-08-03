import { Link } from 'react-router-dom'
import TransitPanel from '../TransitPanel.jsx'
import Card from '../../ui/Card.jsx'
import { useConfig } from '../../config/ConfigContext'

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-600">
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      Live
    </span>
  )
}

export default function TransitMapCard() {
  const cfg = useConfig()
  return (
    <Card title={`${cfg.company.name} transit`} action={<LiveBadge />}>
      <TransitPanel />
    </Card>
  )
}
