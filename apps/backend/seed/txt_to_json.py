#!/usr/bin/env python3
"""
txt_to_json.py
Converts canonical_catalogue.txt → canonical_catalogue.json

Usage:
  python3 txt_to_json.py [input.txt] [output.json]

Defaults:
  input  = canonical_catalogue.txt  (same directory)
  output = canonical_catalogue.json (same directory)
"""

import json, sys, os, re

# ── Type code → full project type name ───────────────────────────────────────
PT_EXPAND = {
    'A': 'residential_apartment',
    'V': 'villa',
    'O': 'commercial_office',
    'R': 'retail_shop',
    'H': 'hospitality',
    'C': 'clinic_healthcare',
    'E': 'education',
    'I': 'industrial_warehouse',
}

# ── Unit code → full unit name ────────────────────────────────────────────────
UNIT_EXPAND = {
    'sf': 'sqft',
    'rf': 'rft',
    'n':  'nos',
    'ls': 'lumpsum',
    '':   None,
}

# ── Qty rule type code → full name ────────────────────────────────────────────
QR_EXPAND = {
    'sm': 'sqft_multiplier',
    'wl': 'wall_linear',
    'cs': 'count_from_sqft',
    'fx': 'fixed',
}

def parse_rate_block(val):
    """Parse 'budget_mr:lr/balanced_mr:lr/premium_mr:lr' → dict"""
    tiers = val.split('/')
    result = {}
    names  = ['budget', 'balanced', 'premium']
    for i, tier in enumerate(tiers[:3]):
        parts = tier.split(':')
        mr = float(parts[0]) if parts[0] else 0.0
        lr = float(parts[1]) if len(parts) > 1 and parts[1] else 0.0
        result[names[i]] = { 'materialRate': mr, 'laborRate': lr }
    return result

def parse_qty_rule(val):
    """Parse 'sm:0.65' or 'fx:1' → dict"""
    parts = val.split(':', 1)
    qtype = QR_EXPAND.get(parts[0], parts[0])
    raw   = parts[1] if len(parts) > 1 else '0'
    num   = float(raw)

    rule = { 'type': qtype }
    if qtype == 'fixed':
        rule['value'] = int(num) if num == int(num) else num
    elif qtype == 'count_from_sqft':
        rule['divisor'] = int(num) if num == int(num) else num
    else:
        rule['multiplier'] = num
    return rule

def parse_budget_block(val):
    """Parse 'ratio:mincost' → (ratio, mincost)"""
    parts = val.split(':')
    ratio   = float(parts[0]) if parts[0] and parts[0] != '0' else None
    mincost = int(parts[1])   if len(parts) > 1 and parts[1] and parts[1] != '0' else None
    return ratio, mincost

def parse_city_multipliers(line):
    """Parse 'city:mult,city:mult,...' → dict"""
    result = {}
    for pair in line.split(','):
        pair = pair.strip()
        if ':' in pair:
            city, mult = pair.split(':', 1)
            result[city.strip()] = float(mult)
    return result

# ── Main parse ────────────────────────────────────────────────────────────────

def parse(txt_path):
    with open(txt_path, 'r', encoding='utf-8') as f:
        raw = f.read()

    city_multipliers = {}
    nodes = []
    current = None

    for line in raw.splitlines():
        line = line.rstrip()

        # Skip blank lines
        if not line:
            continue

        # Header comment — extract city multipliers
        if line.startswith('#'):
            if 'City multipliers:' in line:
                city_part = line.split('City multipliers:')[-1].strip()
                city_multipliers = parse_city_multipliers(city_part)
            continue

        # Annotation blocks — belong to the last node
        if line.startswith('@R '):
            if current:
                current['baselineRates'] = parse_rate_block(line[3:].strip())
            continue

        if line.startswith('@Q '):
            if current:
                current['quantityRule'] = parse_qty_rule(line[3:].strip())
            continue

        if line.startswith('@B '):
            if current:
                ratio, mincost = parse_budget_block(line[3:].strip())
                current['defaultBudgetRatio'] = ratio
                current['minCostEstimate']    = mincost
            continue

        # Data row: LEVEL|ID|LABEL|PARENT|UNIT|FLEX|TYPES|alias1|alias2|...
        parts = line.split('|')
        if len(parts) < 7:
            print(f"WARN: skipping malformed line: {line[:60]}")
            continue

        level_str, cid, label, parent, unit_code, flex_str, types_str = parts[:7]
        aliases = [a.strip() for a in parts[7:] if a.strip()]

        try:
            level = int(level_str)
        except ValueError:
            print(f"WARN: bad level '{level_str}' on line: {line[:60]}")
            continue

        project_types = [PT_EXPAND[c] for c in types_str if c in PT_EXPAND]
        unit          = UNIT_EXPAND.get(unit_code, None)
        is_flexible   = flex_str == '1'

        current = {
            'canonicalId':       cid,
            'label':             label,
            'level':             level,
            'parentId':          parent if parent else None,
            'defaultUnit':       unit,
            'isFlexible':        is_flexible,
            'projectTypes':      project_types,
            'aliases':           aliases,
            'status':            'active',
            'source':            'seed',
            # These get populated by @R / @Q / @B blocks that follow
            'baselineRates':     { 'budget': {'materialRate':0,'laborRate':0},
                                   'balanced': {'materialRate':0,'laborRate':0},
                                   'premium': {'materialRate':0,'laborRate':0} },
            'regionMultipliers': city_multipliers,
            'quantityRule':      None,
            'defaultBudgetRatio': None,
            'minCostEstimate':   None,
        }
        nodes.append(current)

    # Propagate city multipliers to all nodes (all share the same default map)
    if city_multipliers:
        for node in nodes:
            if not node['regionMultipliers']:
                node['regionMultipliers'] = city_multipliers

    print(f"Parsed {len(nodes)} canonical nodes")
    nodes_with_rates = sum(1 for n in nodes if any(
        n['baselineRates'].get(t, {}).get('materialRate', 0) > 0 or
        n['baselineRates'].get(t, {}).get('laborRate', 0) > 0
        for t in ('budget','balanced','premium')
    ))
    nodes_with_qr = sum(1 for n in nodes if n['quantityRule'])
    nodes_with_br = sum(1 for n in nodes if n['defaultBudgetRatio'])
    print(f"  With rates:          {nodes_with_rates}")
    print(f"  With quantity rules: {nodes_with_qr}")
    print(f"  With budget ratios:  {nodes_with_br}")
    return nodes


if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    in_path    = sys.argv[1] if len(sys.argv) > 1 else os.path.join(script_dir, 'canonical_catalogue.txt')
    out_path   = sys.argv[2] if len(sys.argv) > 2 else os.path.join(script_dir, 'canonical_catalogue.json')

    nodes = parse(in_path)

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(nodes, f, indent=2, ensure_ascii=False)

    size_kb = os.path.getsize(out_path) // 1024
    print(f"\nJSON written → {out_path}  ({size_kb}KB)")
    print("Next step: run   node insert_canonical_items.js")
