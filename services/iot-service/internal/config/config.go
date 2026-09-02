package config

import (
	"os"
	"strconv"
)

// Config holds all configuration for the iot-service.
type Config struct {
	// Database
	DBHost     string
	DBName     string
	DBUsername string
	DBPassword string

	// Kafka
	KafkaBootstrapServers string

	// OTLP Receivers
	OTLPGRPCPort string
	OTLPHTTPPort string

	// REST API
	RESTAPIPort string

	// Simulator Fleet
	SimulatorFleet SimulatorFleetConfig

	// Anomaly Detection
	AnomalyThresholds AnomalyThresholds
}

// SimulatorFleetConfig configures the internal device simulator fleet.
type SimulatorFleetConfig struct {
	Enabled bool

	Vehicles FleetDeviceConfig
	Buildings FleetDeviceConfig
	Machines FleetDeviceConfig
}

// FleetDeviceConfig configures a single device type in the fleet.
type FleetDeviceConfig struct {
	Count             int
	EmitIntervalSeconds int
	AnomalyProbability float64
}

// AnomalyThresholds defines threshold rules for anomaly detection.
type AnomalyThresholds struct {
	BuildingHVACTemp         float64 // > threshold for 3 consecutive readings
	BuildingCO2PPM           float64 // > threshold for 2 consecutive readings
	VehicleEngineTemp        float64 // > threshold
	VehicleSpeed             float64 // > threshold
	MachineVibration         float64 // > threshold
	MachineErrorRate         float64 // > threshold
}

// Load reads configuration from environment variables with defaults.
func Load() Config {
	return Config{
		DBHost:     envOrDefault("DB_HOST", "meridian-db-rw"),
		DBName:     envOrDefault("DB_NAME", "meridian"),
		DBUsername: envOrDefault("DB_USERNAME", "meridian"),
		DBPassword: envOrDefault("DB_PASSWORD", "meridian-secret-change-me"),

		KafkaBootstrapServers: envOrDefault("KAFKA_BOOTSTRAP_SERVERS", "meridian-kafka-bootstrap:9092"),

		OTLPGRPCPort: envOrDefault("OTLP_GRPC_PORT", "4317"),
		OTLPHTTPPort: envOrDefault("OTLP_HTTP_PORT", "4318"),
		RESTAPIPort:  envOrDefault("REST_API_PORT", "8086"),

		SimulatorFleet: SimulatorFleetConfig{
			Enabled: envBool("SIMULATOR_ENABLED", true),
			Vehicles: FleetDeviceConfig{
				Count:             envInt("SIMULATOR_FLEET_VEHICLES_COUNT", 30),
				EmitIntervalSeconds: envInt("SIMULATOR_FLEET_VEHICLES_EMIT_INTERVAL_SECONDS", 15),
				AnomalyProbability: envFloat("SIMULATOR_FLEET_VEHICLES_ANOMALY_PROBABILITY", 0.01),
			},
			Buildings: FleetDeviceConfig{
				Count:             envInt("SIMULATOR_FLEET_BUILDINGS_COUNT", 15),
				EmitIntervalSeconds: envInt("SIMULATOR_FLEET_BUILDINGS_EMIT_INTERVAL_SECONDS", 15),
				AnomalyProbability: envFloat("SIMULATOR_FLEET_BUILDINGS_ANOMALY_PROBABILITY", 0.01),
			},
			Machines: FleetDeviceConfig{
				Count:             envInt("SIMULATOR_FLEET_MACHINES_COUNT", 10),
				EmitIntervalSeconds: envInt("SIMULATOR_FLEET_MACHINES_EMIT_INTERVAL_SECONDS", 15),
				AnomalyProbability: envFloat("SIMULATOR_FLEET_MACHINES_ANOMALY_PROBABILITY", 0.01),
			},
		},

		AnomalyThresholds: AnomalyThresholds{
			BuildingHVACTemp: envFloat("ANOMALY_BUILDING_HVAC_TEMP_THRESHOLD", 85.0),
			BuildingCO2PPM:   envFloat("ANOMALY_BUILDING_CO2_PPM_THRESHOLD", 1000.0),
			VehicleEngineTemp: envFloat("ANOMALY_VEHICLE_ENGINE_TEMP_THRESHOLD", 110.0),
			VehicleSpeed:      envFloat("ANOMALY_VEHICLE_SPEED_THRESHOLD", 120.0),
			MachineVibration:  envFloat("ANOMALY_MACHINE_VIBRATION_THRESHOLD", 8.0),
			MachineErrorRate:  envFloat("ANOMALY_MACHINE_ERROR_RATE_THRESHOLD", 5.0),
		},
	}
}

func envOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func envBool(key string, defaultVal bool) bool {
	if val := os.Getenv(key); val != "" {
		if b, err := strconv.ParseBool(val); err == nil {
			return b
		}
	}
	return defaultVal
}

func envInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}

func envFloat(key string, defaultVal float64) float64 {
	if val := os.Getenv(key); val != "" {
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			return f
		}
	}
	return defaultVal
}
