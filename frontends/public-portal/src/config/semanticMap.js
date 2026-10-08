export const ENTITY_SEMANTIC_MAP = {
  'flight_departure': {
    label: 'Flight',
    idField: 'name',
    endpointPrefix: 'To',
  },
  'flight_arrival': {
    label: 'Flight',
    idField: 'name',
    endpointPrefix: 'From',
  },
  'truck': {
    label: 'Truck',
    idField: 'name',
    endpointPrefix: 'Destination',
  },
  // Default fallback
  'default': {
    label: 'Entity',
    idField: 'name',
    endpointPrefix: '',
  }
}
