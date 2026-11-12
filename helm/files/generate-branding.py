import sys
import argparse

def generate_logo_svg(name, brand_color):
    """
    Generates a simple, professional SVG logo.
    Design: A stylized 'M' (for Meridian) in a circle, followed by the company name.
    """
    display_name = name if len(name) < 30 else name[:27] + "..."
    
    # We use a raw string for the SVG to avoid issues with quotes/braces
    return f'''<svg width="400" height="80" viewBox="0 0 400 80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .text {{ font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 600; }}
    </style>
  </defs>
  <circle cx="40" cy="40" r="35" fill="{brand_color}" />
  <path d="M25 55 L25 30 L40 45 L55 30 L55 55" stroke="white" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  <text x="85" y="48" fill="#333" font-size="28" class="text">{display_name}</text>
  <text x="85" y="68" fill="#666" font-size="14" class="text" font-weight="400">Observability Platform</text>
</svg>'''

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True)
    parser.add_argument("--color", required=True)
    parser.add_argument("--output", help="Output file path")
    args = parser.parse_args()
    
    svg = generate_logo_svg(args.name, args.color)
    
    if args.output:
        with open(args.output, "w") as f:
            f.write(svg)
    else:
        print(svg)
