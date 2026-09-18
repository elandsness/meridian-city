import EntityGridListPage from '../components/entity/EntityGridListPage.jsx';

export default function FlightBoard() {
  const flightEntities = [
    {
      id: 'departures',
      entityType: 'flight_departure',
      label: 'Departures',
      fields: [
        { id: 'flight_number', label: 'Flight', subfields: ['airline'] },
        { id: 'destination', label: 'To' },
        { id: 'gate', label: 'Gate' },
      ],
    },
    {
      id: 'arrivals',
      entityType: 'flight_arrival',
      label: 'Arrivals',
      fields: [
        { id: 'flight_number', label: 'Flight', subfields: ['airline'] },
        { id: 'origin', label: 'From' },
        { id: 'gate', label: 'Gate' },
      ],
    },
  ];

  return <EntityGridListPage entities={flightEntities} />;
}
