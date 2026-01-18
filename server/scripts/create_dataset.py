#!/usr/bin/env python3
"""
Phoenix Dataset Creator

Uploads resolved Polymarket data to Phoenix as a reusable dataset.
python create_dataset.py before python optimize.py
"""

import os
import json
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# COLORS
# ============================================================
class C:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    CYAN = '\033[96m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    RESET = '\033[0m'

print(f"{C.CYAN}{C.BOLD}╔═══════════════════════════════════════════════════════════════╗{C.RESET}")
print(f"{C.CYAN}{C.BOLD}║          PHOENIX DATASET CREATOR                              ║{C.RESET}")
print(f"{C.CYAN}{C.BOLD}║          Upload Polymarket test data to Phoenix               ║{C.RESET}")
print(f"{C.CYAN}{C.BOLD}╚═══════════════════════════════════════════════════════════════╝{C.RESET}\n")

# ============================================================
# PHOENIX SETUP
# ============================================================
import phoenix as px

try:
    client = px.Client(endpoint="http://localhost:6006")
    print(f"{C.GREEN}[Phoenix] ✓ Connected to http://localhost:6006{C.RESET}")
except Exception as e:
    print(f"{C.RED}[Phoenix] ✗ Failed to connect: {e}{C.RESET}")
    print(f"{C.YELLOW}Make sure Phoenix is running: docker run -p 6006:6006 arizephoenix/phoenix:latest{C.RESET}")
    exit(1)

# ============================================================
# POLYMARKET API
# ============================================================
GAMMA_API = "https://gamma-api.polymarket.com"
TOPICS = ["Trump", "Bitcoin", "Fed", "election", "China", "Ukraine", "AI", "recession"]

def fetch_markets_by_topic(topic: str, limit: int = 100) -> list:
    """Fetch resolved markets matching a topic keyword"""

    params = {"limit": limit, "closed": "true", "order": "volume", "ascending": "false"}
    response = requests.get(f"{GAMMA_API}/markets", params=params)
    response.raise_for_status()

    markets = []
    topic_lower = topic.lower()

    for m in response.json():
        question = m.get("question", "")
        description = m.get("description", "") or ""

        if topic_lower not in question.lower() and topic_lower not in description.lower():
            continue

        price = 0.5
        if m.get("outcomePrices"):
            try:
                prices = json.loads(m["outcomePrices"]) if isinstance(m["outcomePrices"], str) else m["outcomePrices"]
                if prices:
                    price = float(prices[0])
            except:
                continue

        # Only clear outcomes
        if price >= 0.95:
            outcome = "YES"
        elif price <= 0.05:
            outcome = "NO"
        else:
            continue

        markets.append({
            "id": m.get("id") or m.get("conditionId"),
            "question": question,
            "description": description[:300],
            "topic": topic,
            "yes_price": round(price * 100),
            "no_price": round((1 - price) * 100),
            "outcome": outcome,
            "volume": float(m.get("volume", 0))
        })

    return markets

def create_dataset():
    """Fetch markets and upload to Phoenix as a dataset"""

    print(f"{C.CYAN}[1/3] Fetching resolved markets from Polymarket...{C.RESET}")

    all_markets = []
    for topic in TOPICS:
        print(f"  {C.DIM}Fetching '{topic}'...{C.RESET}", end=" ")
        markets = fetch_markets_by_topic(topic, limit=100)
        all_markets.extend(markets)
        print(f"{C.GREEN}✓ {len(markets)} markets{C.RESET}")

    print(f"\n{C.GREEN}  Total: {len(all_markets)} resolved markets{C.RESET}")

    # ========== CREATE TEST PAIRS ==========
    print(f"\n{C.CYAN}[2/3] Creating test pairs (source → candidates)...{C.RESET}")

    # Group by topic
    by_topic = {}
    for m in all_markets:
        topic = m["topic"]
        if topic not in by_topic:
            by_topic[topic] = []
        by_topic[topic].append(m)

    # Create test examples: each is a source market with candidate markets from same topic
    examples = []
    for topic, markets in by_topic.items():
        if len(markets) < 5:
            continue

        # Take first 3 markets as sources, rest as candidates
        for i in range(min(3, len(markets))):
            source = markets[i]
            candidates = [m for m in markets if m["id"] != source["id"]][:10]

            examples.append({
                "input": {
                    "source_id": source["id"],
                    "source_question": source["question"],
                    "source_description": source["description"],
                    "source_outcome": source["outcome"],
                    "topic": topic,
                    "candidates": candidates
                },
                "expected": {
                    "source_outcome": source["outcome"],
                    "candidate_outcomes": {c["id"]: c["outcome"] for c in candidates}
                },
                "metadata": {
                    "topic": topic,
                    "source_volume": source["volume"]
                }
            })

    print(f"{C.GREEN}  Created {len(examples)} test examples across {len(by_topic)} topics{C.RESET}")

    # ========== UPLOAD TO PHOENIX ==========
    print(f"\n{C.CYAN}[3/3] Uploading dataset to Phoenix...{C.RESET}")

    dataset_name = "polymarket_ground_truth"

    try:
        # Create the dataset
        dataset = client.upload_dataset(
            dataset_name=dataset_name,
            inputs=[ex["input"] for ex in examples],
            outputs=[ex["expected"] for ex in examples],
            metadata=[ex["metadata"] for ex in examples],
        )

        print(f"{C.GREEN}  ✓ Dataset uploaded: {dataset_name}{C.RESET}")
        print(f"{C.GREEN}  ✓ Examples: {len(examples)}{C.RESET}")
        print(f"{C.GREEN}  ✓ View at: http://localhost:6006/datasets{C.RESET}")

    except Exception as e:
        print(f"{C.RED}  ✗ Upload failed: {e}{C.RESET}")

        # Try to check if it already exists
        try:
            existing = client.get_dataset(name=dataset_name)
            print(f"{C.YELLOW}  Dataset '{dataset_name}' already exists. Delete it first or use a new name.{C.RESET}")
        except:
            pass
        return

    # ========== SUMMARY ==========
    print(f"\n{C.GREEN}{'='*65}{C.RESET}")
    print(f"{C.GREEN}{C.BOLD}DATASET CREATED SUCCESSFULLY{C.RESET}")
    print(f"{C.GREEN}{'='*65}{C.RESET}")
    print(f"""
  {C.BOLD}Dataset:{C.RESET} {dataset_name}
  {C.BOLD}Examples:{C.RESET} {len(examples)}
  {C.BOLD}Topics:{C.RESET} {', '.join(by_topic.keys())}

  {C.CYAN}View in Phoenix UI:{C.RESET} http://localhost:6006/datasets

  {C.DIM}Now run: python optimize.py{C.RESET}
""")

if __name__ == "__main__":
    create_dataset()
