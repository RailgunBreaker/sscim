# SSCIM network architecture

## Functional centres

The topology view derives a node for every positive `country × stage` share in the static snapshot. A country can therefore appear in several functions rather than as one undifferentiated dot.

## Connections

For an existing stage edge `a → b`, SSCIM derives a display connection from `countryA × a` to `countryB × b` using the two country shares and the model’s stage-dependence proxy. This is a modeled relationship weight, not a shipment route, trade volume, contract, or facility-to-facility link.

## Interaction

Users can select centres, expand neighborhoods, trace routes, compare metrics, temporarily remove nodes/edges, and reset to the immutable baseline. Temporary removal is a counterfactual sensitivity exercise only.

## Metrics

The topology exposes weighted degree, reachability, betweenness, removal impact, and edge criticality. These metrics answer different graph questions. They must not be blended into SSCIM’s propagation score or treated as independent evidence of real-world importance.

## Design rule

All topology entities and links are derived from the snapshot. The frontend does not invent facility locations, shipment volumes, or bilateral dependencies.
