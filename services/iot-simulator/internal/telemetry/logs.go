package telemetry

import (
	"context"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	logapi "go.opentelemetry.io/otel/log"
	logglobal "go.opentelemetry.io/otel/log/global"
)

// LogEmitter emits templated log records through the global OTel logger
// provider set up by InitOTel.
type LogEmitter struct {
	logger logapi.Logger
}

func NewLogEmitter() *LogEmitter {
	return &LogEmitter{logger: logglobal.Logger("iot-simulator")}
}

// Emit renders template (substituting {device_id}, {device_type}, and
// {parent_id}) and emits it at the given level with device-identifying
// attributes attached.
func (e *LogEmitter) Emit(ctx context.Context, level, template, deviceID, deviceType, parentID string) {
	body := strings.NewReplacer(
		"{device_id}", deviceID,
		"{device_type}", deviceType,
		"{parent_id}", parentID,
	).Replace(template)

	var rec logapi.Record
	rec.SetTimestamp(time.Now())
	rec.SetBody(attribute.StringValue(body))
	rec.SetSeverity(SeverityFromLevel(level))
	rec.AddAttributes(
		attribute.String("device.id", deviceID),
		attribute.String("device.type", deviceType),
	)
	if parentID != "" {
		rec.AddAttributes(attribute.String("device.parent_id", parentID))
	}
	e.logger.Emit(ctx, rec)
}
