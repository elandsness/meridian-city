package health

import (
	"encoding/json"
	"log"
	"net/http"
)

// StartHealthServer starts a lightweight HTTP server on the given port that
// exposes a /health endpoint returning JSON {"status":"ok","service":"iot-ingestion"}.
// This function runs in a goroutine and logs fatal if the server fails.
func StartHealthServer(port string) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "iot-ingestion",
		}); err != nil {
			log.Printf("[health] error encoding response: %v", err)
		}
	})

	addr := ":" + port
	log.Printf("[health] starting health server on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("[health] server error: %v", err)
	}
}
