#!/usr/bin/env python3
import os
import sys
import json
import subprocess
import random
import yaml
from typing import List, Dict, Any

# =============================================================================
# Semantic Seeder — Direct LLM Integration
# =============================================================================
# This script generates industry-specific entity data by talking directly
# to the LLM provider, bypassing the internal application API.
# =============================================================================

def run_cmd(cmd: List[str], check=True):
    res = subprocess.run(cmd, capture_output=True, text=True)
    if check and res.returncode != 0:
        print(f"Error executing {' '.join(cmd)}: {res.stderr}")
        sys.exit(1)
    return res

def load_ai_config(custom_values_path: str):
    """Extracts LLM config from values-custom.yaml"""
    if not os.path.exists(custom_values_path):
        print(f"[WARN] {custom_values_path} not found. Using environment variables.")
        return {
            "provider": os.environ.get("LLM_PROVIDER", "openai"),
            "apiKey": os.environ.get("LLM_API_KEY"),
            "model": os.environ.get("LLM_MODEL", "gpt-4o")
        }
    
    with open(custom_values_path, 'r') as f:
        config = yaml.safe_load(f)
    
    llm = config.get('llm', {})
    provider = llm.get('provider', 'openai')
    
    # Extract provider-specific keys
    provider_cfg = llm.get(provider, {})
    return {
        "provider": provider,
        "apiKey": provider_cfg.get('apiKey'),
        "model": provider_cfg.get('model', 'gpt-4o')
    }

class LLMClient:
    def __init__(self, config: Dict[str, Any]):
        self.provider = config['provider']
        self.apiKey = config['apiKey']
        self.model = config['model']

    def generate(self, prompt: str) -> str:
        if not self.apiKey:
            raise ValueError("LLM API Key is missing. Please set it in values-custom.yaml or env.")

        if self.provider == "openai":
            return self._call_openai(prompt)
        elif self.provider == "anthropic":
            return self._call_anthropic(prompt)
        else:
            print(f"[WARN] Provider {self.provider} not implemented in seeder. Falling back to mock.")
            return "[]"

    def _call_openai(self, prompt: str) -> str:
        import requests
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {self.apiKey}", "Content-Type": "application/json"}
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": "You are a data generation engine. Return ONLY valid JSON arrays."},
                         {"role": "user", "content": prompt}],
            "temperature": 0.7
        }
        resp = requests.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()['choices'][0]['message']['content']

    def _call_anthropic(self, prompt: str) -> str:
        import requests
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": self.model,
            "max_tokens": 2000,
            "messages": [{"role": "user", "content": prompt}]
        }
        resp = requests.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()['content'][0]['text']

def main():
    # 1. Resolve Context
    namespace = os.environ.get("NAMESPACE", "meridian")
    release_name = os.environ.get("RELEASE_NAME", namespace)
    custom_values_path = os.environ.get("CUSTOM_VALUES_PATH", "helm/values-custom.yaml")
    
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

    # Load Industry Configs
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

    # Identify required entities
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
    required_entities.update(['passenger', 'passenger_account'])

    # 2. Initialize AI Client
    ai_config = load_ai_config(custom_values_path)
    llm = LLMClient(ai_config)

    def generate_data(entity_type: str, count: int = 20) -> List[Dict[str, Any]]:
        print(f"[SEED] Generating {count} records for {entity_type}...")
        
        prompt = (
            f"Act as a high-fidelity data generator for a {industry_id} industry simulation. "
            f"Generate {count} realistic records for the entity type: '{entity_type}'. "
            f"Terminology guidance: {json.dumps(terms)}. "
            f"Each record must be a JSON object with a unique ID (prefix 'sem-{entity_type}-') "
            f"and realistic data attributes appropriate for a {industry_id} in a professional setting. "
            f"Return ONLY a JSON array of objects. No markdown, no preamble, no explanation."
        )
        
        try:
            text = llm.generate(prompt)
            # Clean Markdown formatting if LLM includes it
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            return json.loads(text)
        except Exception as e:
            print(f"[WARN] AI generation failed for {entity_type}: {e}. Using fallback defaults.")
            return [{"id": f"sem-{entity_type}-{i}", "data": {"name": f"Generated {i}"}} for i in range(count)]

    # 3. Injection Phase
    print("[SEED] Injecting data into entities schema...")
    for entity_type in required_entities:
        data = generate_data(entity_type)
        for record in data:
            rec_id = record.get('id', f"sem-{entity_type}-{random.randint(1000,9999)}")
            rec_data = record if 'data' in record else record
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
