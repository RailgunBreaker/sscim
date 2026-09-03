# SSCIM public guide

**Model version:** `sscim-model-v7-exposure-robustness` — the exact definition of
every number described here is in the
[model specification](MODEL_V7_SPEC.md).


This guide assumes no background in semiconductors, networks, or statistics. It explains what you are looking at, what each number does and does not mean, and how to avoid the misreadings the interface makes easy.

## The one-paragraph version

Chips are made through a long chain: research and design, then raw materials, then the machines that process them, then fabrication, packaging, and finally the systems people buy. A problem at one point — an export rule, an earthquake, a fire, a capacity decision — can affect points further along. SSCIM is a map of that chain plus an explicit set of rules for exploring what a disruption would touch. It never says "this will happen." It says: *given this event, this snapshot of the industry, and these stated assumptions, these are the parts of the model that become more exposed.*

## A simple way to use it

1. **Start with a reported event.** The event feed lists dated, sourced events. Everything the dashboard shows by default is a live read of that record — there is no scenario library to invent one from, because the number that matters is the one the record actually supports.
2. **Read the source, date, confidence, and stated affected stages** before you read any score. Every score is downstream of those choices.
3. **Follow the selection across all three views.** Selecting anything in one view highlights the corresponding elements in the other two.
4. **Treat a high score as a question to investigate, not an answer.** It tells you where the model thinks you should look.
5. **Track what you actually care about.** The ★ WATCH tab lets you follow specific companies, products (chain stages), plants, or a route through the chain, so your daily view is your own supply base rather than the whole world. The list is kept in your browser and is never put into a shared link.
6. **Review the past when a number surprises you.** The history slider re-derives the entire model as it stood on any past date, and each event marker is sized by what that event actually contributed to the index on its own day.

## The three views

**Map** — countries coloured by modeled exposure, aggregated from the production stages located there. This is *production geography*: where the work physically happens. A company's headquarters country is shown separately and labeled "HQ:", because the two are frequently different, and conflating them is the most common misreading of any supply-chain map.

**Industry flow** — the 24 production stages and the 34 declared dependencies between them. Node size reflects modeled importance; edge thickness reflects modeled input dependence. This is where you can see *why* a shock reached somewhere: follow the edges.

**Topology** — the same structure expanded into functional centres such as `Japan × photoresists` or `Taiwan × advanced fab`, with derived routes between them.

Topology links are modeled, stage-mediated relationships. They are **not** shipping lanes, measured trade flows, or evidence that two companies transact directly.

## How to read a score

Every number sits on a 0–10 scale, but they answer different questions.

**Structural vulnerability** — a relatively stable property of a stage: how geographically concentrated it is, how central in the network, how exposed to policy, how substitutable, how market-sensitive. This barely changes week to week. A high number means "if something goes wrong here, the structure will carry it."

**Operational impact** — the model's response to whatever event you have selected. It is displayed around a neutral value of **5**: above 5 is adverse pressure, below 5 is mitigating. It moves as you change the selection, and decays as events age, halving roughly every 12 days.

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
- **Live, reviewed, or hypothetical** — three states the interface keeps visually distinct, because the worst failure of a dashboard like this is a reader quoting a hypothetical figure as an observed one. *Live* is the current reading. *History review* re-derives the whole model as it stood on a past date — a real past state of the record. *Hazard applied* is the single hypothesis the dashboard will state: a screening shock you place on the map yourself, shown in amber with a one-click exit. History is always baseline: neither a review nor a hazard rewrites the past.

## Common misreadings to avoid

| The interface shows | It does not mean |
| --- | --- |
| A thick edge between two stages | A measured trade volume or a contract |
| A high country score | That country will suffer economic loss |
| A company ranked first by criticality | That company is a good or bad investment |
| A topology route | Goods physically travel that way |
| An index of 6.9 | A 69% chance of anything — the index is not a probability of any kind |
| A sensitivity range (low/base/high) | **Not** a confidence interval. It is an assumption envelope: the span the number moves over as we push our own stated guesses to the ends of the ranges we declared. Nothing establishes that the truth is inside it. |
| A country's score | Its share of the world's problem. There are two country numbers and they answer different questions: **local pressure** ("how hard is the part of the chain that sits here being squeezed?") and **chain contribution** ("how much of the headline number is this country?") |
| A stage or company ranked 10/10 | A number you can compare with last month's 10/10. Those scores are **snapshot-relative** — divided by the biggest value in *this* snapshot — so the raw figure is published beside them for comparisons over time |
| A share of a stage's plants inside a hazard circle | A share of world capacity, or an amount of damage. It is a share of the **plants this project has modelled**, weighted by an analyst's 1–5 significance ordinal |

## Before sharing a conclusion

Check the event's source, its confidence label, how old it is, the stated assumptions, and the model's limitations. Use primary reporting for anything consequential — SSCIM points you at a question; the source answers it.

SSCIM is a research aid. It is not investment, legal, or operational advice.

## Where to go next

- [Plain-English guide](computation-demo/PLAIN_ENGLISH_GUIDE.md) — the same system from zero, with no mathematics.
- [Methodology](METHODOLOGY.md) — why the model is shaped the way it is.
- [**Model v7 specification**](MODEL_V7_SPEC.md) — the exact, canonical definition of every number on the screen, including a worked example you can reproduce with a calculator.
- [Computation demo](computation-demo/COMPUTATION_DEMO.md) — the live engine's own tables, exported as CSV.
- [Model roadmap](MODEL_ROADMAP.md) — what the model does not yet know, stated plainly.
