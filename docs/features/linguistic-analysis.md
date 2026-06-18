# Linguistic Analysis

## Purpose

Linguistic analysis estimates text-based distress indicators from transcript text or direct text input.

## Flow

```text
Text
  -> sentiment model
  -> keyword stress heuristic
  -> stress score
  -> cognitive load label
  -> intervention recommendation
```

## Keyword Heuristic

The keyword layer adds stress weight for known distress-related words or phrases. This makes the system more responsive to direct signals such as urgent requests for help.

## Cognitive Load

The text pipeline maps score bands to:

```text
low
moderate
high
```

## Limitations

Text scoring can miss indirect distress and can overreact to keywords used in benign contexts. Human review is required.
