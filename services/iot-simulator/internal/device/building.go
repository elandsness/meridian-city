package device

import "fmt"

var buildingManufacturers = []string{"SmartBldg Systems", "CityInfra Tech", "UrbanControl"}

// Building simulates a smart-building IoT node (HVAC, energy, occupancy).
type Building struct {
	info            DeviceInfo
	baseHVACTemp    float64
	baseHVACSet     float64
	baseEnergy      float64
	baseOccupancy   float64
	baseCO2         float64
}

// NewBuilding constructs a Building with index-derived baseline values.
func NewBuilding(index int) *Building {
	return &Building{
		info: DeviceInfo{
			ID:           fmt.Sprintf("bldg-%03d", index),
			Zone:         Zones[index%len(Zones)],
			Manufacturer: buildingManufacturers[index%len(buildingManufacturers)],
			Category:     CategoryBuilding,
		},
		baseHVACTemp:  68 + float64(index%10),
		baseHVACSet:   72.0,
		baseEnergy:    700 + float64(index%500),
		baseOccupancy: float64(30 + index*8),
		baseCO2:       400 + float64(index%120),
	}
}

// Info returns static device metadata.
func (b *Building) Info() DeviceInfo { return b.info }

// Readings returns a snapshot of sensor values, optionally with an injected anomaly.
func (b *Building) Readings(anomaly AnomalyType) map[string]float64 {
	hvacTemp := noiseFloat(b.baseHVACTemp, 0.03)
	hvacSet := b.baseHVACSet
	energy := noiseFloat(b.baseEnergy, 0.08)
	occupancy := noiseFloat(b.baseOccupancy, 0.15)
	co2 := noiseFloat(b.baseCO2, 0.05)

	switch anomaly {
	case AnomalyHVACOvertemp:
		hvacTemp = noiseFloat(95, 0.02)
		energy = noiseFloat(b.baseEnergy*2.5, 0.10)
	}

	return map[string]float64{
		"iot.building.hvac_temp":    hvacTemp,
		"iot.building.hvac_setpoint": hvacSet,
		"iot.building.energy_kwh":   energy,
		"iot.building.occupancy":    occupancy,
		"iot.building.co2_ppm":      co2,
	}
}
