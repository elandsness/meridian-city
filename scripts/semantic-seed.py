#!/usr/bin/env python3
import os
import sys
import argparse
import json
import subprocess
import random
import yaml
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

# =============================================================================
# Semantic Seeder — GENERIC REFLECTION EDITION
# =============================================================================
# This script is a pure reflection engine. It reads the industry configuration
# and generates data based on those definitions, knowing nothing about the
# domain (e.g., not knowing what a "flight" is).
# =============================================================================

def run_cmd(cmd: List[str], check=True):
    res = subprocess.run(cmd, capture_output=True, text=True)
    if check and res.returncode != 0:
        print(f"Error executing {' '.join(cmd)}: {res.stderr}")
        sys.exit(1)
    return res

def load_ai_config(custom_values_path: str):
    if not os.path.exists(custom_values_path):
        return {
            "provider": os.environ.get("LLM_PROVIDER", "openai"),
            "apiKey": os.environ.get("LLM_API_KEY"),
            "model": os.environ.get("LLM_MODEL", "gpt-4o")
        }
    with open(custom_values_path, 'r') as f:
        config = yaml.safe_load(f)
    llm = config.get('llm', {})
    provider = llm.get('provider', 'openai')
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
            raise ValueError("LLM API Key is missing.")
        if self.provider == "openai":
            return self._call_openai(prompt)
        elif self.provider == "anthropic":
            return self._call_anthropic(prompt)
        return "[]"

    def _call_openai(self, prompt: str) -> str:
        import requests
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {self.apiKey}", "Content-Type": "application/json"}
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": "You are a data generation engine. Return ONLY valid JSON arrays. No markdown. No preamble."},
                         {"role": "user", "content": prompt}],
            "temperature": 0.7
        }
        resp = requests.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()['choices'][0]['message']['content']

    def _call_anthropic(self, prompt: str) -> str:
        import requests
        url = "https://api.anthropic.com/v1/messages"
        headers = {"x-api-key": self.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json"}
        payload = {"model": self.model, "max_tokens": 2000, "messages": [{"role": "user", "content": prompt}]}
        resp = requests.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()['content'][0]['text']

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--namespace", default=os.environ.get("NAMESPACE", "meridian"))
    parser.add_argument("--release", default=os.environ.get("RELEASE_NAME", os.environ.get("NAMESPACE", "meridian")))
    parser.add_argument("--config-path", default=os.environ.get("CUSTOM_VALUES_PATH", "helm/values-custom.yaml"))
    args = parser.parse_args()

    namespace, release_name, custom_values_path = args.namespace, args.release, args.config_path
    print(f"[SEED] Target: namespace={namespace} release={release_name}")

    pod_res = run_cmd(["kubectl", "get", "pods", "-n", namespace, 
                      "-l", "cnpg.io/cluster=" + f"{release_name}-db", 
                      "--field-selector=status.phase=Running", 
                      "-o", "jsonpath={.items[0].metadata.name}"])
    db_pod = pod_res.stdout.strip()
    if not db_pod:
        print("[ERROR] DB pod not found."); sys.exit(1)

    try:
        with open('industry_config.json', 'r') as f:
            industry_cfg = json.load(f)
        with open('movement_config.json', 'r') as f:
            movement_cfg = json.load(f)
    except FileNotFoundError:
        print("[ERROR] Config files missing."); sys.exit(1)

    industry_meta = industry_cfg.get('industry', {})
    industry_id = industry_meta.get('id', 'generic')
    terminology = industry_meta.get('terminology', {})

    entities_to_seed = {} 
    for ent_type in movement_cfg:
        entities_to_seed[ent_type] = {} 

    screens = industry_meta.get('screens', {})
    for section in screens.values():
        if isinstance(section, list):
            for s in section:
                if isinstance(s, dict) and 'entityType' in s:
                    entities_to_seed[s['entityType']] = {}
                if isinstance(s, dict) and 'entities' in s:
                    for e in s['entities']:
                        entities_to_seed[e['entityType']] = {}

    all_ent_defs = industry_cfg.get('entities', {})
    for etype in entities_to_seed:
        defn = all_ent_defs.get(etype, {})
        entities_to_seed[etype]['fields'] = defn.get('fields', {})
        entities_to_seed[etype]['initial'] = defn.get('initial', 'initial')

    ai_config = load_ai_config(custom_values_path)
    llm = LLMClient(ai_config)

    def generate_generic_data(etype: str, schema: Dict, count: int = 20) -> List[Dict]:
        print(f"[SEED] Reflecting {etype}... Generating {count} records...")
        field_descriptions = [f"- {k}: {v}" for k, v in schema.items()]
        fields_str = "\n".join(field_descriptions)
        prompt = (
            f"Act as a high-fidelity data generator for a {industry_id} simulation. "
            f"Generate {count} realistic records for the entity type '{etype}'. "
            f"Each record MUST be a JSON object. "
            f"Required fields to populate:\n{fields_str}\n"
            f"Also include 'id' matching the pattern 'sem-{etype}-...'. "
            f"Industry Terminology: {json.dumps(terminology)}. "
            f"Return ONLY a JSON array of objects. No markdown."
        )
        try:
            text = llm.generate(prompt)
            if "```json" in text: text = text.split("```json")[1].split("```")[0]
            elif "```" in text: text = text.split("```")[1].split("```")[0]
            return json.loads(text)
        except Exception as e:
            print(f"[WARN] Reflection failed for {etype}: {e}. Creating skeletal records.")
            return [{"id": f"sem-{etype}-{i}", "fallback": True} for i in range(count)]

    all_sql = []
    for etype, meta in entities_to_seed.items():
        data = generate_generic_data(etype, meta.get('fields', {}))
        for record in data:
            rec_id = record.get('id', f"sem-{etype}-{random.randint(1000,9999)}")
            rec_data = record if 'data' not in record else record['data']
            entered_at = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
            transition_at = (datetime.now(timezone.utc) + timedelta(seconds=random.randint(30, 600))).strftime('%Y-%m-%d %H:%M:%S')
            initial_state = meta.get('initial', 'initial')
            json_str = json.dumps(rec_data).replace("'", "''")
            sql = (
                f"INSERT INTO entities.entity (id, entity_type, state, data, links, created_at, updated_at, state_entered_at, next_transition_at) "
                f"VALUES ('{rec_id}', '{etype}', '{initial_state}', "
                f"'{json_str}'::jsonb, '{{}}'::jsonb, NOW(), NOW(), '{entered_at}', '{transition_at}') "
                f"ON CONFLICT (id) DO UPDATE SET state_entered_at='{entered_at}', next_transition_at='{transition_at}', data='{json_str}'::jsonb;"
            )
            all_sql.append(sql)

    print(f"[SEED] Injecting {len(all_sql)} generic records...")
    batch_size = 50
    for i in range(0, len(all_sql), batch_size):
        batch = all_sql[i:i+batch_size]
        full_sql = "BEGIN;\n" + "\n".join(batch) + "\nCOMMIT;"
        process = subprocess.Popen(
            ["kubectl", "exec", "-n", namespace, db_pod, "--", "psql", "-U", "postgres", "-d", "meridian"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        stdout, stderr = process.communicate(input=full_sql)
        if process.returncode != 0 or "ERROR" in stdout or "ERROR" in stderr:
            print(f"[ERROR] Batch {i//batch_size + 1} failed: {stderr} {stdout}")

    print("[SUCCESS] Semantic reflection seeding complete.")

    seed_ticker_headlines(namespace, industry_id, terminology, llm)


def generate_ticker_headlines(industry_id: str, terminology: Dict, label: str, llm: 'LLMClient', count: int = 8) -> List[str]:
    prompt = (
        f"Act as a headline writer for a scrolling news ticker on a {industry_id} "
        f"demo app's home page, labeled '{label}'. "
        f"Generate {count} short, light, funny/cute headlines in the style of "
        f"Onion-style fake local news -- plausible-sounding but silly and warm, never dark "
        f"or mean-spirited. They must read as specific to this industry's own world "
        f"(not generic small-talk), using this terminology where it helps: "
        f"{json.dumps(terminology)}. "
        f"Return ONLY a JSON array of {count} strings. No markdown, no preamble."
    )
    text = llm.generate(prompt)
    if "```json" in text: text = text.split("```json")[1].split("```")[0]
    elif "```" in text: text = text.split("```")[1].split("```")[0]
    items = json.loads(text)
    if not isinstance(items, list) or not all(isinstance(i, str) for i in items):
        raise ValueError("LLM did not return a JSON array of strings")
    return items


def seed_ticker_headlines(namespace: str, industry_id: str, terminology: Dict, llm: 'LLMClient'):
    """Regenerates any `template: ticker` home module's items with fresh,
    industry-flavored headlines via the LLM, then patches the live industry-config
    ConfigMap and restarts the frontends to pick it up (config.json is mounted with
    subPath, which does NOT auto-sync on a ConfigMap change)."""
    cm_res = run_cmd(
        ["kubectl", "get", "configmap", "industry-config", "-n", namespace, "-o", "jsonpath={.data.config\\.json}"],
        check=False,
    )
    if cm_res.returncode != 0 or not cm_res.stdout.strip():
        print("[WARN] Could not read live industry-config ConfigMap -- skipping ticker generation.")
        return

    live_config = json.loads(cm_res.stdout)
    home_sections = [live_config.get("home", {}).get("public", [])]
    updated = False

    for section in home_sections:
        for module in section:
            if not isinstance(module, dict) or module.get("template") != "ticker":
                continue
            label = module.get("label", "NEWS")
            print(f"[SEED] Generating ticker headlines for module '{module.get('id', 'ticker')}'...")
            try:
                module["items"] = generate_ticker_headlines(industry_id, terminology, label, llm)
                updated = True
            except Exception as e:
                print(f"[WARN] Ticker headline generation failed, leaving existing items: {e}")

    if not updated:
        return

    patch = {"data": {"config.json": json.dumps(live_config)}}
    with open("/tmp/industry-config-patch.json", "w") as f:
        json.dump(patch, f)
    run_cmd(["kubectl", "patch", "configmap", "industry-config", "-n", namespace,
              "--type", "merge", "--patch-file", "/tmp/industry-config-patch.json"])

    run_cmd(["kubectl", "rollout", "restart", "deployment/public-portal", "-n", namespace], check=False)

    print("[SUCCESS] Ticker headlines regenerated and live.")


if __name__ == "__main__":
    main()
