package device

import "fmt"

var vehicleManufacturers = []string{"CityFleet Inc", "UrbanMove", "MetroAuto", "SmarTrans"}

// Vehicle simulates a connected city vehicle (bus, maintenance truck, etc.).
type Vehicle struct {
	info           DeviceInfo
	baseSpeed      float64
	baseLat        float64
	baseLon        float64
	baseFuel       float64
	baseEngTemp    float64
}

// NewVehicle constructs a Vehicle with index-derived baseline values.
func NewVehicle(index int) *Vehicle {
	return &Vehicle{
		info: DeviceInfo{
			ID:           fmt.Sprintf("veh-%03d", index),
			Zone:         Zones[index%len(Zones)],
			Manufacturer: vehicleManufacturers[index%len(vehicleManufacturers)],
			Category:     CategoryVehicle,
		},
		baseSpeed:   40 + float64(index%25),
		baseLat:     40.7128 + float64(index)*0.004,
		baseLon:     -74.0060 + float64(index)*0.004,
		baseFuel:    65 + float64(index%35),
		baseEngTemp: 80 + float64(index%15),
	}
}

// Info returns static device metadata.
func (v *Vehicle) Info() DeviceInfo { return v.info }

// Readings returns a snapshot of sensor values, optionally with an injected anomaly.
func (v *Vehicle) Readings(anomaly AnomalyType) map[string]float64 {
	speed := noiseFloat(v.baseSpeed, 0.10)
	engTemp := noiseFloat(v.baseEngTemp, 0.05)
	fuel := noiseFloat(v.baseFuel, 0.03)
	lat := noiseFloat(v.baseLat, 0.001)
	lon := noiseFloat(v.baseLon, 0.001)

	switch anomaly {
	case AnomalyEngineOvertemp:
		engTemp = noiseFloat(120, 0.05)
	case AnomalyHighSpeed:
		speed = noiseFloat(135, 0.03)
	}

	return map[string]float64{
		"iot.vehicle.speed":       speed,
		"iot.vehicle.engine_temp": engTemp,
		"iot.vehicle.fuel_level":  fuel,
		"iot.vehicle.gps_lat":     lat,
		"iot.vehicle.gps_lon":     lon,
	}
}
