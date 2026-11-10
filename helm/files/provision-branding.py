import os
import subprocess
import sys

def generate_logo_svg(name, brand_color):
    display_name = name if len(name) < 30 else name[:27] + "..."
    svg = [
        '<svg width="400" height="80" viewBox="0 0 400 80" xmlns="http://www.w3.org/2000/svg">',
        '  <defs>',
        '    <style>.text { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-weight: 600; }</style>',
        '  </defs>',
        f'  <circle cx="40" cy="40" r="35" fill="{brand_color}" />',
        '  <path d="M25 55 L25 30 L40 45 L55 30 L55 55" stroke="white" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" />',
        f'  <text x="85" y="48" fill="#333" font-size="28" class="text">{display_name}</text>',
        '  <text x="85" y="68" fill="#666" font-size="14" class="text" font-weight="400">Observability Platform</text>',
        '</svg>'
    ]
    return "".join(svg)

def main():
    name = os.environ.get("BRANDING_NAME", "Meridian City")
    color = os.environ.get("BRANDING_COLOR", "#0B3D91")
    namespace = os.environ.get("BRANDING_NAMESPACE", "meridian")
    hash_val = os.environ.get("BRANDING_HASH", "").strip()
    cm_name = f"meridian-branding-{hash_val}" if hash_val else "meridian-branding"
    print(f"Generating logo for {name} ({color})...")
    svg_content = generate_logo_svg(name, color)
    with open("logo.svg", "w") as f:
        f.write(svg_content)
    try:
        cmd = f"kubectl create configmap {cm_name} --from-file=logo.svg=logo.svg -n {namespace} --dry-run=client -o yaml | kubectl apply -f -"
        subprocess.run(cmd, shell=True, check=True)
        print(f"Successfully provisioned branding ConfigMap: {cm_name}")
    except subprocess.CalledProcessError as e:
        print(f"Error provisioning branding: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()