#!/usr/bin/env python3
import os
import sys
import json
import subprocess
import requests
import random
from typing import List, Dict, Any

# =============================================================================
# Semantic Seeder — AI-Driven Data Generation
# =============================================================================
# This script replaces the legacy seed-data.sh for semantic deployments.
# It reads industry configuration, uses the platform's AI service to generate
# realistic industry-specific entity data, and injects it into the DB.
# =============================================================================

def run_cmd(cmd: List[str], check=True):
    res = subprocess.run(cmd, capture_output=True, text=True)
    if check and res.returncode != 0:
        print(f"Error executing {' '.join(cmd)}: {res.stderr}")
        sys.exit(1)
    return res

def get_env_or_default(key: str, default: str):
    return os.environ.get(key, default)

def main():
    # 1. Resolve Context
    namespace = get_env_or_default("NAMESPACE", "meridian")
    release_name = get_env_or_default("RELEASE_NAME", namespace)
    db_pod = None
    
    print(f"[SEED] Target: namespace={namespace} release={release_name}")
    
    # Find DB pod
    pod_res = run_cmd(["kubectl", "get", "pods", "-n", namespace, 
                       "-l", "cnpg.io/cluster=" + f"{release_name}-db", 
                       "--field-selector=status.phase=Running", 
                       "-o", "jsonpath={.items[0].metadata.name}"])
    db_pod = pod_res.stdout.strip()
    if not db_pod:
        print("[ERROR] Could not find running DB pod.")
        sys.exit(1)
    print(f"[SEED] Using DB pod: {db_pod}")

    # Load Configs
    try:
        with open('industry_config.json', 'r') as f:
            industry_cfg = json.load(f)
        with open('movement_config.json', 'r') as f:
            movement_cfg = json.load(f)
    except FileNotFoundError:
        print("[ERROR] Config files (industry_config.json / movement_config.json) not found in CWD.")
        sys.exit(1)

    industry_id = industry_cfg['industry']['id']
    terms = industry_cfg['industry']['terminology']
    print(f"[SEED] Industry detected: {industry_id}")

    # Identify required entities to seed
    required_entities = set()
    for entity in movement_cfg:
        required_entities.add(entity)
    for screen in industry_cfg['industry']['screens']['public']:
        if isinstance(screen, dict) and 'entityType' in screen:
            required_entities.add(screen['entityType'])
    for screen in industry_cfg['industry']['screens']['ops']:
        if isinstance(screen, dict) and 'entities' in screen:
            for ent in screen['entities']:
                required_entities.add(ent['entityType'])
    
    # Ensure essential base entities are present
    required_entities.update(['passenger', 'passenger_account'])

    # 2. Setup AI Connection
    # Note: In a real deploy, we'd use a K8s service URL. 
    # For seed-time, we can route through the API Gateway or use a proxy.
    # Here we assume the seeder runs in an environment where it can reach 
    # the gateway or the service directly.
    ai_url = "http://localhost:3000/api/v1/chat" 
    # If specifically told to use internal K8s DNS (e.g. when running as a Job)
    if os.environ.get("INTERNAL_K8S_DNS") == "true":
        ai_url = "http://api-gateway:3000/api/v1/chat"

    def generate_data(entity_type: str, count: int = 20) -> List[Dict[str, Any]]:
        print(f"[SEED] Generating {count} records for {entity_type}...")
        
        prompt = (
            f"Act as a high-fidelity data generator for a {industry_id} industry simulation. "
            f"Generate {count} realistic records for the entity type: '{entity_type}'. "
            f"Terminology guidance: {json.dumps(terms)}. "
            f"Each record must be a JSON object with a unique ID (prefix 'sem-{entity_type}-') "
            f"and realistic data attributes appropriate for a {industry_id} in a professional setting. "
            f"Return ONLY a JSON array of objects. No markdown, no preamble."
        )
        
        try:
            resp = requests.post(ai_url, json={"message": prompt, "session_id": "seeder"})
            resp.raise_for_status()
            text = resp.json()['response']
            # Strip markdown backticks if LLM insisted on them
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            
            return json.loads(text)
        except Exception as e:
            print(f"[WARN] AI generation failed for {entity_type}: {e}. Using fallback defaults.")
            # Simple fallback to prevent total failure
            return [{"id": f"sem-{entity_type}-{i}", "data": {"name": f"Generated {i}"}} for i in range(count)]

    # 3. Injection Phase
    print("[SEED] Injecting data into entities schema...")
    
    for entity_type in required_entities:
        data = generate_data(entity_type)
        
        for record in data:
            rec_id = record.get('id', f"sem-{entity_type}-{random.randint(1000,9999)}")
            # The entity table expects specific columns. Data goes into the 'data' jsonb column.
            # We assume the LLM might have put everything in the root, so we wrap it.
            rec_data = record if 'data' in record else record
            
            # Construct SQL for the entities table
            # Table: entities.entity (id, entity_type, state, data, links, created_at, updated_at, state_entered_at)
            # We'll set a generic initial state for the industry
            initial_state = "active" if "account" in entity_type else "at_gate" if "flight" in entity_type else "initial"
            
            sql = (
                f"INSERT INTO entities.entity (id, entity_type, state, data, links, created_at, updated_at, state_entered_at) "
                f"VALUES ('{rec_id}', '{entity_type}', '{initial_state}', "
                f"'{json.dumps(rec_data)}'::jsonb, '{{}}'::jsonb, NOW(), NOW(), NOW()) "
                f"ON CONFLICT (id) DO NOTHING;"
            )
            
            run_cmd(["kubectl", "exec", "-n", namespace, db_pod, "--", "psql", "-U", "postgres", "-d", "meridian", "-c", sql])

    print("[SUCCESS] Semantic seeding complete.")

if __name__ == "__main__":
    main()
