# SSCIM public guide

This guide assumes no background in semiconductors, networks, or statistics. It explains what you are looking at, what each number does and does not mean, and how to avoid the misreadings the interface makes easy.

## The one-paragraph version

Chips are made through a long chain: research and design, then raw materials, then the machines that process them, then fabrication, packaging, and finally the systems people buy. A problem at one point — an export rule, an earthquake, a fire, a capacity decision — can affect points further along. SSCIM is a map of that chain plus an explicit set of rules for exploring what a disruption would touch. It never says "this will happen." It says: *given this event, this snapshot of the industry, and these stated assumptions, these are the parts of the model that become more exposed.*

## A simple way to use it

1. **Pick a reported event or build a scenario.** The event feed lists dated, sourced events; the scenario builder lets you invent one.
2. **Read the source, date, confidence, and stated affected stages** before you read any score. Every score is downstream of those choices.
3. **Follow the selection across all three views.** Selecting anything in one view highlights the corresponding elements in the other two.
4. **Treat a high score as a question to investigate, not an answer.** It tells you where the model thinks you should look.

## The three views

**Map** — countries coloured by modeled exposure, aggregated from the production stages located there. This is *production geography*: where the work physically happens. A company's headquarters country is shown separately and labeled "HQ:", because the two are frequently different, and conflating them is the most common misreading of any supply-chain map.

**Industry flow** — the 24 production stages and the 34 declared dependencies between them. Node size reflects modeled importance; edge thickness reflects modeled input dependence. This is where you can see *why* a shock reached somewhere: follow the edges.

**Topology** — the same structure expanded into functional centres such as `Japan × photoresists` or `Taiwan × advanced fab`, with derived routes between them.

Topology links are modeled, stage-mediated relationships. They are **not** shipping lanes, measured trade flows, or evidence that two companies transact directly.

## How to read a score

Every number sits on a 0–10 scale, but they answer different questions.

**Structural vulnerability** — a relatively stable property of a stage: how geographically concentrated it is, how central in the network, how exposed to policy, how substitutable, how market-sensitive. This barely changes week to week. A high number means "if something goes wrong here, the structure will carry it."

**Operational impact** — the model's response to whatever event or scenario you have selected. It is displayed around a neutral value of **5**: above 5 is adverse pressure, below 5 is mitigating. It moves as you change the selection, and decays as events age, halving roughly every 12 days.

**Contribution** — a company's share of an aggregate modeled effect, weighted by how much of a stage that company holds. It is **not** an estimate of that company's financial loss.

**Vulnerability vs. contribution** for companies: vulnerability ignores size, so a small and a large firm in the same stage are equally exposed per unit of activity; contribution accounts for size. Both are shown because collapsing them into one number would hide one of the two facts.

### What these scores are not

They compare items **inside this model**, against each other, in this snapshot. They are not probabilities, forecasts, realized losses, trade volumes, or market signals. Two stages scoring 7 and 4 means the model ranks the first as more exposed under these assumptions — not that one is 75% more likely to fail.

## Reading the honesty markers

The interface labels the provenance of what it shows, and those labels are the most useful thing on screen:

- **`[GRAPH/DATA]`** — computed from the structure or the dataset.
- **`[ANALYST]`** — a human judgment call, written down deliberately rather than hidden.
- **Confidence (High / Medium / Low / Simulated)** — how good the *evidence* is. It is deliberately **not** folded into the size of the effect, so a low-confidence large event and a high-confidence small one never look alike.
- **Excluded from score** — the event is displayed and explained but deliberately left out of the aggregate index, because forcing it into one signed number would misrepresent it. A hazard warning where nothing was actually disrupted is the clearest example.
- **Baseline vs. active** — history is always baseline, real events only. A scenario you build is shown as a comparison point and never rewrites the past.

## Common misreadings to avoid

| The interface shows | It does not mean |
| --- | --- |
| A thick edge between two stages | A measured trade volume or a contract |
| A high country score | That country will suffer economic loss |
| A company ranked first by criticality | That company is a good or bad investment |
| A topology route | Goods physically travel that way |
| An index of 6.9 | A 69% chance of anything |
| A sensitivity range (low/base/high) | A confidence interval |

## Before sharing a conclusion

Check the event's source, its confidence label, how old it is, the stated assumptions, and the model's limitations. Use primary reporting for anything consequential — SSCIM points you at a question; the source answers it.

SSCIM is a research aid. It is not investment, legal, or operational advice.

## Where to go next

- [Plain-English guide](computation-demo/PLAIN_ENGLISH_GUIDE.md) — the same system from zero, with no mathematics.
- [Methodology](METHODOLOGY.md) — the actual formulas, if you want to check the reasoning.
- [Computation demo](computation-demo/COMPUTATION_DEMO.md) — every step worked with real numbers.
- [Model roadmap](MODEL_ROADMAP.md) — what the model does not yet know, stated plainly.
