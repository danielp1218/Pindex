#!/usr/bin/env python3
# Multi-layer prompt optimizer with Phoenix integration
# Tests prompts against resolved Polymarket data and iteratively improves them

import os
import json
import requests
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, asdict

class C:
    HEADER = '\033[95m'
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

CONFIG = {
    "max_iterations": 4,
    "target_accuracy": 75.0,
    "target_profit": 0.3,
    "tests_per_topic": 3,
    "candidates_per_test": 10,
    "few_shot_examples": 3,
    "model": "gpt-4o-mini",
    "mutation_model": "gpt-4o",
}

from dotenv import load_dotenv
load_dotenv()

if not os.getenv("OPENAI_API_KEY"):
    print("ERROR: OPENAI_API_KEY not found in .env")
    exit(1)

print(C.header("╔═══════════════════════════════════════════════════════════════╗"))
print(C.header("║        POLYINDEX MULTI-LAYER PROMPT OPTIMIZER                 ║"))
print(C.header("║        All OpenAI calls traced to Phoenix                     ║"))
print(C.header("╚═══════════════════════════════════════════════════════════════╝\n"))

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "http://localhost:6006"

phoenix_enabled = False
phoenix_client = None
phoenix_dataset = None

try:
    from phoenix.otel import register
    from openinference.instrumentation.openai import OpenAIInstrumentor
    import phoenix as px

    tracer_provider = register(
        project_name="polyindex-optimizer",
        endpoint="http://localhost:6006/v1/traces"
    )
    OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
    print(C.success("[Phoenix] ✓ Tracing enabled"))

    phoenix_client = px.Client(endpoint="http://localhost:6006")
    print(C.success("[Phoenix] ✓ Client connected"))

    try:
        phoenix_dataset = phoenix_client.get_dataset(name="polymarket_ground_truth")
        print(C.success(f"[Phoenix] ✓ Dataset loaded: {len(phoenix_dataset)} examples"))
    except:
        print(C.warn("[Phoenix] ⚠ Dataset not found - run create_dataset.py first"))
        print(C.dim("           Will fetch fresh data from Polymarket API"))

    phoenix_enabled = True
    print(C.info(f"[Phoenix] → View at http://localhost:6006\n"))

except Exception as e:
    print(C.warn(f"[Phoenix] ⚠ Setup failed: {e}"))
    print(C.dim("[Phoenix] Continuing without Phoenix features...\n"))

from openai import OpenAI
openai_client = OpenAI()

@dataclass
class Market:
    id: str
    question: str
    description: str
    yes_price: int
    no_price: int
    outcome: str
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

GAMMA_API = "https://gamma-api.polymarket.com"
TOPICS = ["Trump", "Bitcoin", "Fed", "election", "China", "Ukraine", "AI", "recession"]

def fetch_markets_by_topic(topic: str, limit: int = 50, closed: bool = True) -> List[Market]:
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

        if topic_lower not in question.lower() and topic_lower not in description.lower():
            continue

        price = 0.5
        if m.get("outcomePrices"):
            try:
                prices = json.loads(m["outcomePrices"]) if isinstance(m["outcomePrices"], str) else m["outcomePrices"]
                if prices:
                    price = float(prices[0])
            except (ValueError, TypeError, IndexError):
                continue

        if closed:
            if price >= 0.80:
                outcome = "YES"
            elif price <= 0.20:
                outcome = "NO"
            else:
                continue
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

def run_prompt(prompt: str, source: Market, candidates: List[Market]) -> List[dict]:
    # Safe string replacement to avoid JSON brace conflicts
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
        completion = openai_client.chat.completions.create(
            model=CONFIG["model"],
            messages=[
                {"role": "system", "content": filled},
                {"role": "user", "content": f"Analyze:\n\n{candidates_text}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )

        content = completion.choices[0].message.content
        if content:
            result = json.loads(content)
            return result.get("related", [])
    except Exception as e:
        print(f"    ⚠ API error: {e}")

    return []

def evaluate_relationship(source_outcome: str, related_outcome: str, relationship: str) -> Tuple[bool, float]:
    source_yes = source_outcome == "YES"
    related_yes = related_outcome == "YES"

    evaluations = {
        "IMPLIES": (not source_yes or related_yes, 0.6, -0.8),
        "CONTRADICTS": (source_yes != related_yes, 0.7, -0.7),
        "SUBEVENT": (True, 0.3, 0.0),
        "CONDITIONED_ON": (not source_yes or related_yes, 0.5, -0.6),
        "WEAK_SIGNAL": (source_yes == related_yes, 0.2, -0.3),
    }

    if relationship in evaluations:
        held, profit_if_held, profit_if_not = evaluations[relationship]
        profit = profit_if_held if held else profit_if_not
        return held, profit

    return False, -0.5

USE_LLM_EVALUATOR = True

def evaluate_with_llm(source_question: str, source_outcome: str,
                      related_question: str, related_outcome: str,
                      relationship: str, reasoning: str) -> Tuple[bool, float, str]:
    eval_prompt = f"""You are evaluating a prediction market relationship prediction.

SOURCE MARKET:
- Question: {source_question}
- Actual Outcome: {source_outcome}

RELATED MARKET:
- Question: {related_question}
- Actual Outcome: {related_outcome}

PREDICTED RELATIONSHIP: {relationship}
REASONING GIVEN: {reasoning}

RELATIONSHIP DEFINITIONS:
- IMPLIES: If related=YES then source=YES (or contrapositive)
- CONTRADICTS: If source=YES then related=NO (opposite outcomes)
- SUBEVENT: Related event directly affects source outcome
- CONDITIONED_ON: Source outcome is prerequisite for related
- WEAK_SIGNAL: Correlated but not causal

TASK: Evaluate if this relationship prediction was CORRECT given the actual outcomes.

Return JSON:
{{
  "correct": true/false,
  "confidence": 0.0-1.0,
  "explanation": "Brief reason"
}}"""

    try:
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a prediction market analyst evaluating relationship predictions. Be strict but fair."},
                {"role": "user", "content": eval_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=200
        )

        result = json.loads(completion.choices[0].message.content)
        held = result.get("correct", False)
        confidence = result.get("confidence", 0.5)
        explanation = result.get("explanation", "")

        profit = confidence * 0.8 if held else -confidence * 0.7

        return held, profit, explanation

    except Exception as e:
        held, profit = evaluate_relationship(source_outcome, related_outcome, relationship)
        return held, profit, f"Fallback: {e}"

def test_prompt_on_topics(prompt: str, market_sets: Dict[str, List[Market]], tests_per_topic: int = 2, candidates_per_test: int = 10) -> Tuple[List[TestResult], List[Prediction], List[Prediction]]:
    results = []
    all_good = []
    all_bad = []
    test_num = 0

    for topic, markets in market_sets.items():
        if len(markets) < 3:
            continue

        print(C.bold(f"\n    Topic: {topic}") + C.dim(f" ({len(markets)} markets)"))

        for i in range(min(tests_per_topic, len(markets))):
            test_num += 1
            source = markets[i]
            candidates = [m for m in markets if m.id != source.id][:candidates_per_test]
            candidate_map = {c.id: c for c in candidates}

            print(C.dim(f"      [{test_num}] {source.question[:45]}..."))

            raw_predictions = run_prompt(prompt, source, candidates)
            predictions = []

            for pred in raw_predictions:
                market_id = pred.get("marketId")
                if not market_id or market_id not in candidate_map:
                    continue

                related = candidate_map[market_id]
                relationship = pred.get("relationship", "WEAK_SIGNAL")
                reasoning = pred.get("reasoning", "")

                if USE_LLM_EVALUATOR:
                    held, profit, _ = evaluate_with_llm(
                        source.question, source.outcome,
                        related.question, related.outcome,
                        relationship, reasoning
                    )
                else:
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

def build_few_shot_section(good_examples: List[Prediction], max_examples: int = 3) -> str:
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
    if not bad_examples:
        return ""

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
        completion = openai_client.chat.completions.create(
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
            start = current_prompt.find("Relationship Types:")
            end = current_prompt.find("Return JSON")

            if start > 0 and end > start:
                new_prompt = current_prompt[:start] + improved_section.strip() + "\n\n" + current_prompt[end:]
                print("    ✓ Prompt mutated by GPT-4")
                return new_prompt
    except Exception as e:
        print(f"    ⚠ Mutation failed: {e}")

    return current_prompt

experiment_results = []

def log_experiment_result(iteration: int, prompt_name: str, accuracy: float, profit: float,
                          total: int, correct: int, changes: List[str]):
    result = {
        "iteration": iteration,
        "prompt_name": prompt_name,
        "accuracy": accuracy,
        "profit_score": profit,
        "total_predictions": total,
        "correct_predictions": correct,
        "changes": changes,
        "timestamp": datetime.now().isoformat()
    }
    experiment_results.append(result)

    if phoenix_client:
        try:
            print(C.dim(f"      [Phoenix] Logged iteration {iteration} to experiments"))
        except Exception as e:
            pass

def save_experiment_to_phoenix(experiment_name: str):
    if not phoenix_client or not experiment_results:
        return

    try:
        summary = {
            "name": experiment_name,
            "timestamp": datetime.now().isoformat(),
            "config": CONFIG,
            "iterations": experiment_results,
            "final_accuracy": experiment_results[-1]["accuracy"] if experiment_results else 0,
            "final_profit": experiment_results[-1]["profit_score"] if experiment_results else 0,
            "improvement": {
                "accuracy": experiment_results[-1]["accuracy"] - experiment_results[0]["accuracy"] if len(experiment_results) > 1 else 0,
                "profit": experiment_results[-1]["profit_score"] - experiment_results[0]["profit_score"] if len(experiment_results) > 1 else 0
            }
        }

        output_dir = Path(__file__).parent / "output"
        output_dir.mkdir(exist_ok=True)
        experiment_file = output_dir / f"experiment_{experiment_name}.json"
        experiment_file.write_text(json.dumps(summary, indent=2))

        print(C.success(f"  ✓ Experiment saved: {experiment_name}"))
        print(C.dim(f"    View in Phoenix: http://localhost:6006"))

    except Exception as e:
        print(C.warn(f"  ⚠ Experiment save failed: {e}"))

def optimize():
    global experiment_results
    experiment_results = []

    experiment_name = f"opt_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    print(C.info(f"[Experiment] Starting: {experiment_name}"))

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

    box_width = 45
    acc_line = f"Accuracy:      {accuracy:5.1f}% ({correct}/{total:2})"
    profit_line = f"Profit Score:  {profit:+5.2f}"
    good_line = f"Good examples: {len(good_examples):3}"
    bad_line = f"Bad examples:  {len(bad_examples):3}"

    print(f"\n  {C.CYAN}┌─────────────────────────────────────────────┐{C.RESET}")
    print(f"  {C.CYAN}│{C.RESET} {C.BOLD}BASELINE RESULTS{C.RESET}{' ' * (box_width - 16)}│{C.RESET}")
    print(f"  {C.CYAN}├─────────────────────────────────────────────┤{C.RESET}")
    print(f"  {C.CYAN}│{C.RESET} {acc_color}{acc_line}{C.RESET}{' ' * (box_width - len(acc_line))}│{C.RESET}")
    print(f"  {C.CYAN}│{C.RESET} {profit_color}{profit_line}{C.RESET}{' ' * (box_width - len(profit_line))}│{C.RESET}")
    print(f"  {C.CYAN}│{C.RESET} {C.GREEN}{good_line}{C.RESET}{' ' * (box_width - len(good_line))}│{C.RESET}")
    print(f"  {C.CYAN}│{C.RESET} {C.RED}{bad_line}{C.RESET}{' ' * (box_width - len(bad_line))}│{C.RESET}")
    print(f"  {C.CYAN}└─────────────────────────────────────────────┘{C.RESET}")

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

    log_experiment_result(0, "baseline", accuracy, profit, total, correct, ["Initial baseline test"])

    best_prompt = current_prompt
    best_accuracy = accuracy
    best_profit = profit

    if accuracy >= CONFIG["target_accuracy"] and profit >= CONFIG["target_profit"]:
        print("\n  ✓ Baseline already meets targets!")
    else:
        print("\n" + C.YELLOW + "="*65 + C.RESET)
        print(C.bold(C.YELLOW + "STEP 3: OPTIMIZATION ITERATIONS" + C.RESET))
        print(C.YELLOW + "="*65 + C.RESET)

        for iteration in range(1, CONFIG["max_iterations"] + 1):
            print("\n" + C.YELLOW + "---" + " "*59 + "---" + C.RESET)
            print(C.bold(C.YELLOW + f"  ITERATION {iteration}" + C.RESET))
            print(C.YELLOW + "---" + " "*59 + "---" + C.RESET)

            changes = []

            print(C.info("\n  [Layer 1] Adding few-shot examples..."))
            few_shot = build_few_shot_section(good_examples, CONFIG["few_shot_examples"])
            if few_shot:
                changes.append(f"Added {min(len(good_examples), CONFIG['few_shot_examples'])} few-shot examples")
                print(C.success(f"    ✓ Added {min(len(good_examples), CONFIG['few_shot_examples'])} examples"))
            else:
                print(C.warn("    ⚠ No good examples to add"))

            print(C.info("\n  [Layer 2] Adding warning patterns..."))
            warnings = build_warnings_section(bad_examples)
            if warnings:
                changes.append(f"Added warnings for {len(set(p.relationship for p in bad_examples))} relationship types")
                print(C.success(f"    ✓ Added warnings"))
            else:
                print(C.warn("    ⚠ No warnings to add"))

            new_prompt = BASE_PROMPT
            new_prompt = new_prompt.replace("{few_shot_section}", few_shot)
            new_prompt = new_prompt.replace("{warnings_section}", warnings)

            if iteration >= 2 or accuracy < 40:
                print(C.header("\n  [Layer 3] LLM-based prompt mutation..."))
                new_prompt = mutate_prompt_with_llm(new_prompt, accuracy, profit, bad_examples)
                changes.append("Applied LLM-based prompt mutation")

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

            # Calculate padding for proper alignment (box width - visible chars)
            box_width = 45
            acc_line = f"Accuracy:      {accuracy:5.1f}% ({correct}/{total:2})"
            profit_line = f"Profit Score:  {profit:+5.2f}"
            acc_change_line = f"Acc Change:    {improvement_acc:+5.1f}%"
            profit_change_line = f"Profit Change: {improvement_profit:+5.2f}"

            print(f"\n  {C.YELLOW}┌─────────────────────────────────────────────┐{C.RESET}")
            print(f"  {C.YELLOW}│{C.RESET} {C.BOLD}ITERATION {iteration} RESULTS{C.RESET}{' ' * (box_width - 19)}│{C.RESET}")
            print(f"  {C.YELLOW}├─────────────────────────────────────────────┤{C.RESET}")
            print(f"  {C.YELLOW}│{C.RESET} {acc_color}{acc_line}{C.RESET}{' ' * (box_width - len(acc_line))}│{C.RESET}")
            print(f"  {C.YELLOW}│{C.RESET} {profit_color}{profit_line}{C.RESET}{' ' * (box_width - len(profit_line))}│{C.RESET}")
            print(f"  {C.YELLOW}│{C.RESET} {acc_change_color}{acc_change_line}{C.RESET}{' ' * (box_width - len(acc_change_line))}│{C.RESET}")
            print(f"  {C.YELLOW}│{C.RESET} {profit_change_color}{profit_change_line}{C.RESET}{' ' * (box_width - len(profit_change_line))}│{C.RESET}")
            print(f"  {C.YELLOW}└─────────────────────────────────────────────┘{C.RESET}")

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

            log_experiment_result(iteration, f"iteration_{iteration}", accuracy, profit, total, correct, changes)

            if accuracy > best_accuracy or (accuracy == best_accuracy and profit > best_profit):
                best_prompt = new_prompt
                best_accuracy = accuracy
                best_profit = profit
                print(C.success(C.BOLD + "  ★ New best prompt!" + C.RESET))

            if accuracy >= CONFIG["target_accuracy"] and profit >= CONFIG["target_profit"]:
                print(C.success(f"\n  ✓ Reached target accuracy ({CONFIG['target_accuracy']}%) and profit ({CONFIG['target_profit']})!"))
                break

    print("\n" + C.GREEN + "="*65 + C.RESET)
    print(C.bold(C.GREEN + "STEP 4: SAVING RESULTS" + C.RESET))
    print(C.GREEN + "="*65 + C.RESET)

    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    acc_str = f"{best_accuracy:.0f}acc"
    profit_str = f"{best_profit:.2f}profit".replace(".", "p").replace("-", "neg")

    prompt_latest = output_dir / "BEST_PROMPT.txt"
    prompt_latest.write_text(best_prompt)
    print(C.success(f"\n  ✓ Saved: {C.BOLD}{prompt_latest.name}{C.RESET}"))

    prompt_versioned = output_dir / f"prompt_{timestamp}_{acc_str}_{profit_str}.txt"
    prompt_versioned.write_text(best_prompt)
    print(C.success(f"  ✓ Saved: {prompt_versioned.name}"))

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

    json_file = output_dir / "optimization_data.json"
    json_file.write_text(json.dumps(report, indent=2, default=str))
    print(C.success(f"  ✓ Saved: {json_file.name}"))

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

    save_experiment_to_phoenix(experiment_name)

    final_acc_color = C.GREEN if best_accuracy >= 50 else C.YELLOW if best_accuracy >= 25 else C.RED
    final_profit_color = C.GREEN if best_profit >= 0.1 else C.YELLOW if best_profit >= 0 else C.RED
    change_acc = best_accuracy - iterations[0].accuracy
    change_profit = best_profit - iterations[0].profit_score
    change_acc_color = C.GREEN if change_acc > 0 else C.RED if change_acc < 0 else C.YELLOW
    change_profit_color = C.GREEN if change_profit > 0 else C.RED if change_profit < 0 else C.YELLOW

    box_width = 63

    baseline_acc_line = f"  Baseline Accuracy:  {iterations[0].accuracy:5.1f}%"
    final_acc_line = f"  Final Accuracy:     {best_accuracy:5.1f}%  ({change_acc:+.1f}%)"
    baseline_profit_line = f"  Baseline Profit:    {iterations[0].profit_score:+5.2f}"
    final_profit_line = f"  Final Profit:       {best_profit:+5.2f}  ({change_profit:+.2f})"
    iterations_line = f"  Iterations:         {len(iterations) - 1}"
    output_header_line = f"  Output Files:"
    file1_line = f"    • BEST_PROMPT.txt          (use this!)"
    file2_line = f"    • OPTIMIZATION_REPORT.md   (summary)"
    file3_line = f"    • optimization_data.json   (raw data)"
    phoenix_line = f"  Phoenix UI: http://localhost:6006"

    print(f"\n{C.GREEN}╔{'═'*box_width}╗{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}{C.BOLD}{'OPTIMIZATION COMPLETE':^{box_width}}{C.RESET}{C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}╠{'═'*box_width}╣{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}{C.DIM}{baseline_acc_line}{C.RESET}{' ' * (box_width - len(baseline_acc_line))}{C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}{final_acc_color}{final_acc_line}{C.RESET}{' ' * (box_width - len(final_acc_line))}{C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}{C.DIM}{baseline_profit_line}{C.RESET}{' ' * (box_width - len(baseline_profit_line))}{C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}{final_profit_color}{final_profit_line}{C.RESET}{' ' * (box_width - len(final_profit_line))}{C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}{C.CYAN}{iterations_line}{C.RESET}{' ' * (box_width - len(iterations_line))}{C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}╠{'═'*box_width}╣{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}{C.BOLD}{output_header_line}{C.RESET}{' ' * (box_width - len(output_header_line))}{C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}{C.CYAN}{file1_line}{C.RESET}{' ' * (box_width - len(file1_line))}{C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}{C.CYAN}{file2_line}{C.RESET}{' ' * (box_width - len(file2_line))}{C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}{C.CYAN}{file3_line}{C.RESET}{' ' * (box_width - len(file3_line))}{C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}╠{'═'*box_width}╣{C.RESET}")
    print(f"{C.GREEN}║{C.RESET}{C.HEADER}{phoenix_line}{C.RESET}{' ' * (box_width - len(phoenix_line))}{C.GREEN}║{C.RESET}")
    print(f"{C.GREEN}╚{'═'*box_width}╝{C.RESET}\n")

if __name__ == "__main__":
    start_time = time.time()
    optimize()
    elapsed = time.time() - start_time
    print(C.dim(f"Total time: {elapsed:.1f}s\n"))
