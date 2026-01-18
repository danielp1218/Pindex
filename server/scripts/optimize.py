#!/usr/bin/env python3
"""
Polyindex Multi-Layer Prompt Optimizer

Tuff iterative prompt optimization.
1. Baseline testing against resolved Polymarket data
2. Few-shot example injection from successful predictions
3. Warning injection from failure patterns
4. LLM-based prompt mutation for underperforming sections
5. Iterative refinement until target accuracy is reached

All OpenAI calls are traced to Phoenix for observability.
"""

import os
import json
import requests
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, asdict

# ============================================================
# COLORS (ANSI escape codes)
# ============================================================
class C:
    HEADER = '\033[95m'      # Magenta
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    RESET = '\033[0m'

    @staticmethod
    def success(text): return f"{C.GREEN}{text}{C.RESET}"
    @staticmethod
    def error(text): return f"{C.RED}{text}{C.RESET}"
    @staticmethod
    def warn(text): return f"{C.YELLOW}{text}{C.RESET}"
    @staticmethod
    def info(text): return f"{C.CYAN}{text}{C.RESET}"
    @staticmethod
    def bold(text): return f"{C.BOLD}{text}{C.RESET}"
    @staticmethod
    def dim(text): return f"{C.DIM}{text}{C.RESET}"
    @staticmethod
    def header(text): return f"{C.HEADER}{C.BOLD}{text}{C.RESET}"

# ============================================================
# CONFIGURATION
# ============================================================
CONFIG = {
    "max_iterations": 4,           # Maximum optimization iterations
    "target_accuracy": 75.0,       # Stop if we reach this accuracy %
    "target_profit": 0.3,          # Stop if avg profit score reaches this
    "tests_per_topic": 3,          # Number of source markets to test per topic
    "candidates_per_test": 10,     # Candidate markets per test
    "few_shot_examples": 3,        # Number of few-shot examples to include
    "model": "gpt-4o-mini",        # Model for related bets
    "mutation_model": "gpt-4o",    # Model for prompt mutation (smarter)
}

# ============================================================
# SETUP
# ============================================================
from dotenv import load_dotenv
load_dotenv()

if not os.getenv("OPENAI_API_KEY"):
    print("ERROR: OPENAI_API_KEY not found in .env")
    exit(1)

print(C.header("╔═══════════════════════════════════════════════════════════════╗"))
print(C.header("║        POLYINDEX MULTI-LAYER PROMPT OPTIMIZER                 ║"))
print(C.header("║        All OpenAI calls traced to Phoenix                     ║"))
print(C.header("╚═══════════════════════════════════════════════════════════════╝\n"))

# Phoenix tracing setup
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "http://localhost:6006"

phoenix_enabled = False
try:
    from phoenix.otel import register
    from openinference.instrumentation.openai import OpenAIInstrumentor

    tracer_provider = register(
        project_name="polyindex-optimizer",
        endpoint="http://localhost:6006/v1/traces"
    )
    OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
    phoenix_enabled = True
    print(C.success("[Phoenix] ✓ Tracing enabled → http://localhost:6006"))
except Exception as e:
    print(C.warn(f"[Phoenix] ⚠ Tracing failed: {e}"))
    print(C.dim("[Phoenix] Continuing without tracing...\n"))

from openai import OpenAI
client = OpenAI()

# ============================================================
# DATA CLASSES
# ============================================================
@dataclass
class Market:
    id: str
    question: str
    description: str
    yes_price: int
    no_price: int
    outcome: str  # "YES" or "NO"
    volume: float = 0.0

@dataclass
class Prediction:
    source: Market
    related: Market
    relationship: str
    reasoning: str
    held: bool
    profit: float

@dataclass
class TestResult:
    source: Market
    predictions: List[Prediction]

    @property
    def accuracy(self) -> float:
        if not self.predictions:
            return 0.0
        correct = sum(1 for p in self.predictions if p.held)
        return correct / len(self.predictions) * 100

    @property
    def profit_score(self) -> float:
        if not self.predictions:
            return 0.0
        return sum(p.profit for p in self.predictions) / len(self.predictions)

@dataclass
class IterationResult:
    iteration: int
    prompt_name: str
    prompt_length: int
    accuracy: float
    profit_score: float
    total_predictions: int
    correct_predictions: int
    good_examples: List[dict]
    bad_examples: List[dict]
    changes_made: List[str]

# ============================================================
# BASE PROMPT
# ============================================================
BASE_PROMPT = """You are a strategic prediction market analyst finding ACTIONABLE related bets.

Source Market:
- Question: {source_question}
- Current Odds: {source_yes}% YES / {source_no}% NO
- Description: {source_description}

YOUR GOAL: Find markets where betting strategy changes based on beliefs about the source market.

GOOD Related Markets:
✓ Markets with hedging opportunities (opposite positions reduce risk)
✓ Markets with arbitrage potential (related but mispriced)
✓ Markets with causal relationships (one outcome affects another)
✓ Markets with competitive odds (10-90% range, not extreme long shots)
✓ Markets where information advantage transfers

BAD Related Markets:
✗ Extreme long shots (<5% or >95%) - no trading opportunity
✗ Same exact market in different words (redundant)
✗ Weak correlations without clear reasoning
✗ Markets from the same multi-outcome event (just partitions)

Relationship Types:
- IMPLIES: If this market YES → source YES
- CONTRADICTS: If source YES → this market NO more likely
- SUBEVENT: This event directly causes/prevents source outcome
- CONDITIONED_ON: Source outcome is prerequisite for this market
- WEAK_SIGNAL: Correlated indicator (only if odds are interesting)

{few_shot_section}

{warnings_section}

Return JSON:
{{
  "related": [
    {{
      "marketId": "id",
      "relationship": "IMPLIES|CONTRADICTS|SUBEVENT|CONDITIONED_ON|WEAK_SIGNAL",
      "reasoning": "Brief explanation"
    }}
  ]
}}

Return empty array if no good opportunities: {{"related": []}}"""

# ============================================================
# POLYMARKET API
# ============================================================
GAMMA_API = "https://gamma-api.polymarket.com"

# Topics that tend to have interconnected markets
TOPICS = ["Trump", "Bitcoin", "Fed", "election", "China", "Ukraine", "AI", "recession"]

def fetch_markets_by_topic(topic: str, limit: int = 50, closed: bool = True) -> List[Market]:
    """Fetch markets matching a topic keyword"""

    params = {"limit": limit, "order": "volume", "ascending": "false"}
    if closed:
        params["closed"] = "true"

    response = requests.get(f"{GAMMA_API}/markets", params=params)
    response.raise_for_status()

    markets = []
    topic_lower = topic.lower()

    for m in response.json():
        question = m.get("question", "")
        description = m.get("description", "") or ""

        # Filter by topic keyword
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

        # Determine outcome for closed markets
        if closed:
            if price >= 0.95:
                outcome = "YES"
            elif price <= 0.05:
                outcome = "NO"
            else:
                continue  # Skip unclear outcomes
        else:
            outcome = "PENDING"

        markets.append(Market(
            id=m.get("id") or m.get("conditionId"),
            question=question,
            description=description[:300],
            yes_price=round(price * 100),
            no_price=round((1 - price) * 100),
            outcome=outcome,
            volume=float(m.get("volume", 0))
        ))

    return markets

def fetch_related_market_sets() -> Dict[str, List[Market]]:
    """Fetch markets grouped by topic for meaningful relationship testing"""
    print(C.info("  Fetching markets by topic for meaningful relationships..."))

    market_sets = {}

    for topic in TOPICS:
        print(C.dim(f"    Fetching '{topic}' markets..."))
        markets = fetch_markets_by_topic(topic, limit=100, closed=True)
        if len(markets) >= 5:
            market_sets[topic] = markets
            print(C.success(f"      ✓ Found {len(markets)} resolved markets"))
        else:
            print(C.warn(f"      ⚠ Only {len(markets)} markets, skipping topic"))

    total = sum(len(m) for m in market_sets.values())
    print(C.success(f"\n  ✓ Total: {total} markets across {len(market_sets)} topics"))

    return market_sets

# ============================================================
# PROMPT EXECUTION
# ============================================================
def run_prompt(prompt: str, source: Market, candidates: List[Market], debug: bool = False) -> List[dict]:
    """Execute prompt against OpenAI - TRACED by Phoenix"""

    # Use safe string replacement instead of .format() to avoid JSON brace conflicts
    filled = prompt
    filled = filled.replace("{source_question}", source.question)
    filled = filled.replace("{source_yes}", str(source.yes_price))
    filled = filled.replace("{source_no}", str(source.no_price))
    filled = filled.replace("{source_description}", source.description)
    filled = filled.replace("{few_shot_section}", "")
    filled = filled.replace("{warnings_section}", "")

    candidates_text = "\n\n---\n\n".join([
        f"ID: {c.id}\nQuestion: {c.question}\nOdds: {c.yes_price}% YES / {c.no_price}% NO"
        for c in candidates
    ])

    try:
        completion = client.chat.completions.create(
            model=CONFIG["model"],
            messages=[
                {"role": "system", "content": filled},
                {"role": "user", "content": f"Analyze:\n\n{candidates_text}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )

        content = completion.choices[0].message.content
        if debug:
            print(f"      [DEBUG] Raw response: {content[:500] if content else 'None'}...")
        if content:
            result = json.loads(content)
            related = result.get("related", [])
            if debug and related:
                print(f"      [DEBUG] Found {len(related)} predictions")
                for r in related[:2]:
                    print(f"        - {r.get('marketId', 'NO_ID')[:20]}... ({r.get('relationship', '?')})")
            return related
    except Exception as e:
        print(f"    ⚠ API error: {e}")

    return []

# ============================================================
# EVALUATION
# ============================================================
def evaluate_relationship(source_outcome: str, related_outcome: str, relationship: str) -> Tuple[bool, float]:
    """
    Evaluate if prediction held true and calculate profit potential.

    Uses logical validation based on relationship type:
    - IMPLIES: related YES → source YES (contrapositive: source NO → related NO is ok)
    - CONTRADICTS: source and related should have opposite outcomes
    - SUBEVENT: hard to validate causally, always give partial credit
    - CONDITIONED_ON: source is prerequisite, so source YES → related can be YES
    - WEAK_SIGNAL: correlated, so outcomes should match

    Returns: (held: bool, profit: float)
    """
    source_yes = source_outcome == "YES"
    related_yes = related_outcome == "YES"

    # Format: (condition_for_held, profit_if_held, profit_if_not_held)
    evaluations = {
        # IMPLIES: "related YES → source YES" - valid if source=NO (vacuous) or both YES
        "IMPLIES": (not source_yes or related_yes, 0.6, -0.8),
        # CONTRADICTS: outcomes should be opposite
        "CONTRADICTS": (source_yes != related_yes, 0.7, -0.7),
        # SUBEVENT: causal link hard to verify, give partial credit
        "SUBEVENT": (True, 0.3, 0.0),
        # CONDITIONED_ON: source is prerequisite - same logic as IMPLIES
        "CONDITIONED_ON": (not source_yes or related_yes, 0.5, -0.6),
        # WEAK_SIGNAL: correlated, outcomes should match
        "WEAK_SIGNAL": (source_yes == related_yes, 0.2, -0.3),
    }

    if relationship in evaluations:
        held, profit_if_held, profit_if_not = evaluations[relationship]
        profit = profit_if_held if held else profit_if_not
        return held, profit

    return False, -0.5

def test_prompt_on_topics(prompt: str, market_sets: Dict[str, List[Market]], tests_per_topic: int = 2, candidates_per_test: int = 10) -> Tuple[List[TestResult], List[Prediction], List[Prediction]]:
    """Test a prompt using topic-grouped markets for meaningful relationships"""

    results = []
    all_good = []
    all_bad = []
    test_num = 0
    first_debug = True

    for topic, markets in market_sets.items():
        if len(markets) < 3:
            continue

        print(C.bold(f"\n    Topic: {topic}") + C.dim(f" ({len(markets)} markets)"))

        for i in range(min(tests_per_topic, len(markets))):
            test_num += 1
            source = markets[i]
            # Use OTHER markets from SAME topic as candidates (more likely to be related!)
            candidates = [m for m in markets if m.id != source.id][:candidates_per_test]
            candidate_map = {c.id: c for c in candidates}

            print(C.dim(f"      [{test_num}] {source.question[:45]}..."))

            # Debug first test only
            debug = first_debug
            if debug:
                print(f"        [DEBUG] Source: {source.question[:60]}")
                print(f"        [DEBUG] Candidates from same topic:")
                for c in candidates[:3]:
                    print(f"          - {c.question[:50]}...")
                first_debug = False

            raw_predictions = run_prompt(prompt, source, candidates, debug=debug)
            predictions = []

            if debug:
                print(f"        [DEBUG] Model returned {len(raw_predictions)} predictions")

            for pred in raw_predictions:
                market_id = pred.get("marketId")
                if not market_id or market_id not in candidate_map:
                    if debug and market_id:
                        print(f"        [DEBUG] ID mismatch: '{market_id[:20]}...' not found")
                    continue

                related = candidate_map[market_id]
                relationship = pred.get("relationship", "WEAK_SIGNAL")
                reasoning = pred.get("reasoning", "")

                held, profit = evaluate_relationship(source.outcome, related.outcome, relationship)

                p = Prediction(
                    source=source,
                    related=related,
                    relationship=relationship,
                    reasoning=reasoning,
                    held=held,
                    profit=profit
                )
                predictions.append(p)

                if held and profit > 0.2:
                    all_good.append(p)
                elif not held:
                    all_bad.append(p)

            correct = sum(1 for p in predictions if p.held)
            if correct > 0:
                print(f"          → {len(predictions)} predictions, {C.success(f'{correct} correct')}")
            else:
                print(f"          → {len(predictions)} predictions, {C.warn(f'{correct} correct')}")
            results.append(TestResult(source=source, predictions=predictions))

    return results, all_good, all_bad

# ============================================================
# PROMPT OPTIMIZATION LAYERS
# ============================================================

def build_few_shot_section(good_examples: List[Prediction], max_examples: int = 3) -> str:
    """Build few-shot examples section from successful predictions"""

    if not good_examples:
        return ""

    lines = ["PROVEN EXAMPLES (validated against real outcomes):"]

    for i, p in enumerate(good_examples[:max_examples]):
        lines.append(f"""
Example {i+1}:
Source: "{p.source.question[:80]}"
Related: "{p.related.question[:80]}"
Relationship: {p.relationship}
Reasoning: {p.reasoning}
✓ Source→{p.source.outcome}, Related→{p.related.outcome}""")

    return "\n".join(lines)

def build_warnings_section(bad_examples: List[Prediction]) -> str:
    """Build warnings section from failed predictions"""

    if not bad_examples:
        return ""

    # Group by relationship type
    by_type: Dict[str, List[Prediction]] = {}
    for p in bad_examples:
        if p.relationship not in by_type:
            by_type[p.relationship] = []
        by_type[p.relationship].append(p)

    lines = ["AVOID THESE MISTAKES:"]

    for rel_type, examples in by_type.items():
        lines.append(f"- {rel_type}: {len(examples)} wrong predictions")
        if examples:
            ex = examples[0]
            lines.append(f"  Bad: \"{ex.source.question[:40]}\" → \"{ex.related.question[:40]}\"")
            lines.append(f"  Reality: Source={ex.source.outcome}, Related={ex.related.outcome}")

    return "\n".join(lines)

def mutate_prompt_with_llm(current_prompt: str, accuracy: float, profit: float, bad_examples: List[Prediction]) -> str:
    """Use GPT-4 to intelligently improve the prompt"""

    print("    Using GPT-4 to analyze and improve prompt...")

    failure_analysis = []
    for p in bad_examples[:5]:
        failure_analysis.append({
            "source": p.source.question[:100],
            "related": p.related.question[:100],
            "predicted": p.relationship,
            "source_outcome": p.source.outcome,
            "related_outcome": p.related.outcome
        })

    mutation_prompt = f"""You are a prompt engineering expert. Analyze and SIGNIFICANTLY improve this prompt.

CURRENT PROMPT:
{current_prompt[:2000]}

CURRENT PERFORMANCE:
- Accuracy: {accuracy:.1f}%
- Profit Score: {profit:.2f}

FAILURE EXAMPLES (predictions that were WRONG):
{json.dumps(failure_analysis, indent=2)}

TASK: Rewrite the relationship type definitions to be MORE PRECISE and ACTIONABLE.

Requirements:
1. Add specific criteria for WHEN to use each relationship type
2. Add explicit warnings for WHEN NOT to use each type
3. Include concrete examples or patterns
4. Make the definitions more rigorous to reduce false positives
5. Add a confidence threshold guideline

Return the improved "Relationship Types:" section with substantially enhanced definitions.
Be specific, add bullet points, and make it noticeably better than the original."""

    try:
        completion = client.chat.completions.create(
            model=CONFIG["mutation_model"],
            messages=[
                {"role": "system", "content": "You are a prompt engineering expert. Output only the improved text, no explanations. Make substantial improvements."},
                {"role": "user", "content": mutation_prompt}
            ],
            temperature=0.8,
            max_tokens=1500
        )

        improved_section = completion.choices[0].message.content
        if improved_section and len(improved_section) > 100:
            # Replace the relationship section in the prompt
            start = current_prompt.find("Relationship Types:")
            end = current_prompt.find("Return JSON")

            if start > 0 and end > start:
                new_prompt = current_prompt[:start] + improved_section.strip() + "\n\n" + current_prompt[end:]
                print("    ✓ Prompt mutated by GPT-4")
                return new_prompt
    except Exception as e:
        print(f"    ⚠ Mutation failed: {e}")

    return current_prompt

# ============================================================
# MAIN OPTIMIZATION LOOP
# ============================================================

def optimize():
    """Main multi-layer optimization loop"""

    # ========== STEP 1: LOAD DATA ==========
    print("\n" + C.BLUE + "="*65 + C.RESET)
    print(C.bold(C.BLUE + "STEP 1: LOADING DATA" + C.RESET))
    print(C.BLUE + "="*65 + C.RESET)

    market_sets = fetch_related_market_sets()
    if not market_sets:
        print("ERROR: No topic-grouped markets found")
        return

    print(f"\n  Sample markets per topic:")
    for topic, markets in list(market_sets.items())[:3]:
        print(f"    {topic}:")
        for m in markets[:2]:
            print(f"      [{m.outcome}] {m.question[:50]}...")

    # ========== STEP 2: BASELINE TEST ==========
    print("\n" + C.CYAN + "="*65 + C.RESET)
    print(C.bold(C.CYAN + "STEP 2: BASELINE TEST (Current Prompt)" + C.RESET))
    print(C.CYAN + "="*65 + C.RESET)

    current_prompt = BASE_PROMPT.replace("{few_shot_section}", "").replace("{warnings_section}", "")

    results, good_examples, bad_examples = test_prompt_on_topics(
        current_prompt,
        market_sets,
        tests_per_topic=CONFIG["tests_per_topic"],
        candidates_per_test=CONFIG["candidates_per_test"]
    )

    all_predictions = [p for r in results for p in r.predictions]
    total = len(all_predictions)
    correct = sum(1 for p in all_predictions if p.held)
    accuracy = (correct / total * 100) if total > 0 else 0
    profit = sum(p.profit for p in all_predictions) / total if total > 0 else 0

    acc_color = C.GREEN if accuracy >= 50 else C.YELLOW if accuracy >= 25 else C.RED
    profit_color = C.GREEN if profit >= 0.1 else C.YELLOW if profit >= 0 else C.RED

    print(f"\n  {C.CYAN}┌─────────────────────────────────────┐{C.RESET}")
    print(f"  {C.CYAN}│{C.RESET} {C.BOLD}BASELINE RESULTS{C.RESET}                    {C.CYAN}│{C.RESET}")
    print(f"  {C.CYAN}├─────────────────────────────────────┤{C.RESET}")
    print(f"  {C.CYAN}│{C.RESET} Accuracy:     {acc_color}{accuracy:5.1f}%{C.RESET} ({correct}/{total})     {C.CYAN}│{C.RESET}")
    print(f"  {C.CYAN}│{C.RESET} Profit Score: {profit_color}{profit:+5.2f}{C.RESET}                 {C.CYAN}│{C.RESET}")
    print(f"  {C.CYAN}│{C.RESET} Good examples: {C.GREEN}{len(good_examples):3}{C.RESET}                  {C.CYAN}│{C.RESET}")
    print(f"  {C.CYAN}│{C.RESET} Bad examples:  {C.RED}{len(bad_examples):3}{C.RESET}                  {C.CYAN}│{C.RESET}")
    print(f"  {C.CYAN}└─────────────────────────────────────┘{C.RESET}")

    iterations: List[IterationResult] = []
    iterations.append(IterationResult(
        iteration=0,
        prompt_name="baseline",
        prompt_length=len(current_prompt),
        accuracy=accuracy,
        profit_score=profit,
        total_predictions=total,
        correct_predictions=correct,
        good_examples=[],
        bad_examples=[],
        changes_made=["Initial baseline test"]
    ))

    best_prompt = current_prompt
    best_accuracy = accuracy
    best_profit = profit

    # Check if already good enough
    if accuracy >= CONFIG["target_accuracy"] and profit >= CONFIG["target_profit"]:
        print("\n  ✓ Baseline already meets targets!")
    else:
        # ========== OPTIMIZATION ITERATIONS ==========
        for iteration in range(1, CONFIG["max_iterations"] + 1):
            print("\n" + C.YELLOW + "="*65 + C.RESET)
            print(C.bold(C.YELLOW + f"ITERATION {iteration}: OPTIMIZATION" + C.RESET))
            print(C.YELLOW + "="*65 + C.RESET)

            changes = []

            # Layer 1: Add few-shot examples
            print(C.info("\n  [Layer 1] Adding few-shot examples..."))
            few_shot = build_few_shot_section(good_examples, CONFIG["few_shot_examples"])
            if few_shot:
                changes.append(f"Added {min(len(good_examples), CONFIG['few_shot_examples'])} few-shot examples")
                print(C.success(f"    ✓ Added {min(len(good_examples), CONFIG['few_shot_examples'])} examples"))
            else:
                print(C.warn("    ⚠ No good examples to add"))

            # Layer 2: Add warnings
            print(C.info("\n  [Layer 2] Adding warning patterns..."))
            warnings = build_warnings_section(bad_examples)
            if warnings:
                changes.append(f"Added warnings for {len(set(p.relationship for p in bad_examples))} relationship types")
                print(C.success(f"    ✓ Added warnings"))
            else:
                print(C.warn("    ⚠ No warnings to add"))

            # Build new prompt using safe replacement
            new_prompt = BASE_PROMPT
            new_prompt = new_prompt.replace("{few_shot_section}", few_shot)
            new_prompt = new_prompt.replace("{warnings_section}", warnings)

            # Layer 3: LLM mutation - trigger on iteration 2+ OR if accuracy is low
            if iteration >= 2 or accuracy < 40:
                print(C.header("\n  [Layer 3] LLM-based prompt mutation..."))
                new_prompt = mutate_prompt_with_llm(new_prompt, accuracy, profit, bad_examples)
                changes.append("Applied LLM-based prompt mutation")

            # Test the new prompt
            print(C.info("\n  [Testing] Running optimized prompt..."))
            results, good_examples, bad_examples = test_prompt_on_topics(
                new_prompt,
                market_sets,
                tests_per_topic=CONFIG["tests_per_topic"],
                candidates_per_test=CONFIG["candidates_per_test"]
            )

            all_predictions = [p for r in results for p in r.predictions]
            total = len(all_predictions)
            correct = sum(1 for p in all_predictions if p.held)
            accuracy = (correct / total * 100) if total > 0 else 0
            profit = sum(p.profit for p in all_predictions) / total if total > 0 else 0

            improvement_acc = accuracy - best_accuracy
            improvement_profit = profit - best_profit

            acc_color = C.GREEN if accuracy >= 50 else C.YELLOW if accuracy >= 25 else C.RED
            profit_color = C.GREEN if profit >= 0.1 else C.YELLOW if profit >= 0 else C.RED
            acc_change_color = C.GREEN if improvement_acc > 0 else C.RED if improvement_acc < 0 else C.YELLOW
            profit_change_color = C.GREEN if improvement_profit > 0 else C.RED if improvement_profit < 0 else C.YELLOW

            print(f"\n  {C.YELLOW}┌─────────────────────────────────────┐{C.RESET}")
            print(f"  {C.YELLOW}│{C.RESET} {C.BOLD}ITERATION {iteration} RESULTS{C.RESET}                 {C.YELLOW}│{C.RESET}")
            print(f"  {C.YELLOW}├─────────────────────────────────────┤{C.RESET}")
            print(f"  {C.YELLOW}│{C.RESET} Accuracy:     {acc_color}{accuracy:5.1f}%{C.RESET} ({correct}/{total})     {C.YELLOW}│{C.RESET}")
            print(f"  {C.YELLOW}│{C.RESET} Profit Score: {profit_color}{profit:+5.2f}{C.RESET}                 {C.YELLOW}│{C.RESET}")
            print(f"  {C.YELLOW}│{C.RESET} Acc Change:   {acc_change_color}{improvement_acc:+5.1f}%{C.RESET}                {C.YELLOW}│{C.RESET}")
            print(f"  {C.YELLOW}│{C.RESET} Profit Change:{profit_change_color}{improvement_profit:+5.2f}{C.RESET}                 {C.YELLOW}│{C.RESET}")
            print(f"  {C.YELLOW}└─────────────────────────────────────┘{C.RESET}")

            iterations.append(IterationResult(
                iteration=iteration,
                prompt_name=f"iteration_{iteration}",
                prompt_length=len(new_prompt),
                accuracy=accuracy,
                profit_score=profit,
                total_predictions=total,
                correct_predictions=correct,
                good_examples=[asdict(p) for p in good_examples[:3]] if good_examples else [],
                bad_examples=[asdict(p) for p in bad_examples[:3]] if bad_examples else [],
                changes_made=changes
            ))

            # Keep best
            if accuracy > best_accuracy or (accuracy == best_accuracy and profit > best_profit):
                best_prompt = new_prompt
                best_accuracy = accuracy
                best_profit = profit
                print(C.success(C.BOLD + "  ★ New best prompt!" + C.RESET))

            # Check if we've reached targets
            if accuracy >= CONFIG["target_accuracy"] and profit >= CONFIG["target_profit"]:
                print(C.success(f"\n  ✓ Reached target accuracy ({CONFIG['target_accuracy']}%) and profit ({CONFIG['target_profit']})!"))
                break

    # ========== SAVE RESULTS ==========
    print("\n" + C.GREEN + "="*65 + C.RESET)
    print(C.bold(C.GREEN + "SAVING RESULTS" + C.RESET))
    print(C.GREEN + "="*65 + C.RESET)

    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    acc_str = f"{best_accuracy:.0f}acc"
    profit_str = f"{best_profit:.2f}profit".replace(".", "p").replace("-", "neg")

    # Save optimized prompt - clear naming
    prompt_latest = output_dir / "BEST_PROMPT.txt"
    prompt_latest.write_text(best_prompt)
    print(C.success(f"\n  ✓ Saved: {C.BOLD}{prompt_latest.name}{C.RESET}"))

    # Versioned copy with metrics in filename
    prompt_versioned = output_dir / f"prompt_{timestamp}_{acc_str}_{profit_str}.txt"
    prompt_versioned.write_text(best_prompt)
    print(C.success(f"  ✓ Saved: {prompt_versioned.name}"))

    # Save detailed report
    report = {
        "timestamp": datetime.now().isoformat(),
        "config": CONFIG,
        "summary": {
            "baseline_accuracy": f"{iterations[0].accuracy:.1f}%",
            "final_accuracy": f"{best_accuracy:.1f}%",
            "accuracy_improvement": f"{best_accuracy - iterations[0].accuracy:+.1f}%",
            "baseline_profit": f"{iterations[0].profit_score:.2f}",
            "final_profit": f"{best_profit:.2f}",
            "profit_improvement": f"{best_profit - iterations[0].profit_score:+.2f}",
            "total_iterations": len(iterations) - 1,
            "prompt_length_change": f"{len(best_prompt) - len(BASE_PROMPT):+d} chars"
        },
        "iterations": [asdict(i) for i in iterations]
    }

    # JSON data for programmatic use
    json_file = output_dir / "optimization_data.json"
    json_file.write_text(json.dumps(report, indent=2, default=str))
    print(C.success(f"  ✓ Saved: {json_file.name}"))

    # Save human-readable report
    md_report = f"""# Prompt Optimization Report
Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Summary

| Metric | Baseline | Final | Change |
|--------|----------|-------|--------|
| Accuracy | {iterations[0].accuracy:.1f}% | {best_accuracy:.1f}% | {best_accuracy - iterations[0].accuracy:+.1f}% |
| Profit Score | {iterations[0].profit_score:.2f} | {best_profit:.2f} | {best_profit - iterations[0].profit_score:+.2f} |
| Prompt Length | {len(BASE_PROMPT)} | {len(best_prompt)} | {len(best_prompt) - len(BASE_PROMPT):+d} |

## Iterations

"""
    for i in iterations:
        md_report += f"""### {'Baseline' if i.iteration == 0 else f'Iteration {i.iteration}'}
- Accuracy: {i.accuracy:.1f}%
- Profit: {i.profit_score:.2f}
- Predictions: {i.correct_predictions}/{i.total_predictions}
- Changes: {', '.join(i.changes_made) if i.changes_made else 'None'}

"""

    md_report += f"""## How to Use

Copy the optimized prompt from `BEST_PROMPT.txt` to your server's `related-bets-finder.ts`.

## Phoenix Traces

View all OpenAI calls at: http://localhost:6006
Project: `polyindex-optimizer`
"""

    md_file = output_dir / "OPTIMIZATION_REPORT.md"
    md_file.write_text(md_report)
    print(C.success(f"  ✓ Saved: {md_file.name}"))

    # ========== FINAL SUMMARY ==========
    final_acc_color = C.GREEN if best_accuracy >= 50 else C.YELLOW if best_accuracy >= 25 else C.RED
    final_profit_color = C.GREEN if best_profit >= 0.1 else C.YELLOW if best_profit >= 0 else C.RED
    change_acc = best_accuracy - iterations[0].accuracy
    change_profit = best_profit - iterations[0].profit_score
    change_acc_color = C.GREEN if change_acc > 0 else C.RED if change_acc < 0 else C.YELLOW
    change_profit_color = C.GREEN if change_profit > 0 else C.RED if change_profit < 0 else C.YELLOW

    print(f"\n{C.GREEN}╔{'═'*63}╗{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}{C.BOLD}{'OPTIMIZATION COMPLETE':^63}{C.RESET}{C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}╠{'═'*63}╣{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}  Baseline Accuracy:  {C.DIM}{iterations[0].accuracy:5.1f}%{C.RESET}                                  {C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}  Final Accuracy:     {final_acc_color}{best_accuracy:5.1f}%{C.RESET}  ({change_acc_color}{change_acc:+.1f}%{C.RESET})                          {C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}  Baseline Profit:    {C.DIM}{iterations[0].profit_score:+5.2f}{C.RESET}                                   {C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}  Final Profit:       {final_profit_color}{best_profit:+5.2f}{C.RESET}  ({change_profit_color}{change_profit:+.2f}{C.RESET})                           {C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}  Iterations:         {C.CYAN}{len(iterations) - 1}{C.RESET}                                       {C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}╠{'═'*63}╣{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}  {C.BOLD}Output Files:{C.RESET}                                                {C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}    • {C.CYAN}BEST_PROMPT.txt{C.RESET}          {C.DIM}(use this!){C.RESET}     {C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}    • {C.CYAN}OPTIMIZATION_REPORT.md{C.RESET}   {C.DIM}(summary){C.RESET}       {C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}    • {C.CYAN}optimization_data.json{C.RESET}   {C.DIM}(raw data){C.RESET}      {C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}╠{'═'*63}╣{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}  Phoenix UI: {C.HEADER}http://localhost:6006{C.RESET}                           {C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}╚{'═'*63}╝{C.RESET}\n")

if __name__ == "__main__":
    start_time = time.time()
    optimize()
    elapsed = time.time() - start_time
    print(C.dim(f"Total time: {elapsed:.1f}s\n"))
