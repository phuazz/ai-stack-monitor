"""Investor map in the reference tracker's L0–L12 order. US listings, USD prices."""

def layer(title, name, members, controls, label, context, question):
    return dict(title=title, name=name, members=members.split(), controls=controls.split(),
                label=label, context=context, question=question)


MAP = {
    "energy": layer("Energy & power", "Power producers", "CEG VST NRG", "XLU", "US utilities",
        "Power producers and competitive power suppliers. Generation mix, hedges and retail exposure differ. Utility returns also reflect regulated rate bases.",
        "How many contracted megawatts have an enforceable delivery date and a completed grid connection?"),
    "power": layer("Data centres & servers", "Power and cooling", "VRT ETN NVT TT", "XLI", "US industrials",
        "Electrical distribution and thermal equipment. Landlords and server assemblers have different economics and sit outside this basket.",
        "How much of the order book has a deposit, a committed delivery date and secured power at the site?"),
    "equipment": layer("Chip design & equipment", "Wafer fabrication equipment", "AMAT LRCX KLAC", "SOXX", "US-listed semiconductors",
        "Process and inspection equipment suppliers depend on fab investment. Chip design software earns licence revenue and is outside this comparison.",
        "Which tool orders have passed fab qualification, and which can the customer defer?"),
    "foundry": layer("Foundries", "Contract chip manufacturers", "TSM GFS UMC", "SOXX", "US-listed semiconductors",
        "Listed foundries earn wafer revenue. Leading-edge and mature-node exposure differ, so a move concentrated in one manufacturer needs separate interpretation.",
        "Is the customer reserving leading-edge capacity, mature-node wafers or advanced packaging, and how binding is that reservation?"),
    "compute": layer("Compute silicon", "GPU designers", "NVDA AMD", "SOXX", "US-listed semiconductors",
        "Two GPU designers with material non-AI businesses. Memory, custom silicon and processor IP have separate economics.",
        "Does the customer have a production deployment and repeat accelerator orders after the first cluster?"),
    "network": layer("Networking & interconnect", "Networking and optical interconnect", "ANET CIEN LITE COHR CRDO", "XLK", "US technology",
        "Switching, optical transport and connectivity suppliers. Broad US technology is the opportunity-cost benchmark.",
        "Which optical or switching orders have passed customer qualification, and how much volume rests on one cluster build?"),
    "cloud": layer("Cloud & neoclouds", "Specialist cloud", "CRWV NBIS", "MSFT AMZN GOOGL ORCL", "Hyperscalers",
        "Two specialist providers compared with Microsoft, Amazon, Alphabet and Oracle. One issuer changes participation by 50 percentage points.",
        "How much contracted GPU revenue is take-or-pay, and does it cover debt service over the hardware’s economic life?"),
    "models": layer("Foundation models", "Meta Platforms", "META", "XLC", "US communication services",
        "Single-company reference. Meta develops foundation models, but the listed equity also reflects advertising and other businesses. Private model developers have no price series here.",
        "After inference costs, what gross profit does the model provider retain per paying customer as usage grows?"),
    "data": layer("Data & AI software", "Data platforms", "SNOW MDB ESTC", "IGV", "US-listed software",
        "Data platforms span warehousing, operational databases and search. Consumption and subscription revenue mixes differ.",
        "How much incremental data consumption persists after the initial AI deployment?"),
    "security": layer("Agent platforms & security", "Cybersecurity platforms", "PANW CRWD ZS", "IGV", "US-listed software",
        "Enterprise security platforms proxy the security side of this layer. Their equity returns also reflect established network, endpoint and cloud security spending.",
        "Is agent security winning a new budget, or being bundled into an existing platform renewal?"),
    "payments": layer("Commerce & payments", "Card payment networks", "V MA", "XLF", "US financials",
        "Two global card networks provide a read on transaction rails. Consumer spending, cross-border mix and regulation dominate the broader business.",
        "Can the company identify repeat agent-initiated transactions and the net fee it retains after network costs?"),
    "apps": layer("Apps & agents", "Enterprise workflow platforms", "CRM NOW", "IGV", "US-listed software",
        "Two incumbent enterprise platforms distribute agents into existing workflows. Standalone agent economics require customer-level evidence.",
        "Which agent pilots converted into paid production, and what margin remains after inference and implementation?"),
    "devices": layer("Devices & physical AI", "Edge semiconductor suppliers", "QCOM NXPI STM", "SOXX", "US-listed semiconductors",
        "Chip suppliers to device, automotive and embedded markets. Handset demand, industrial inventories and automotive cycles also drive these shares.",
        "What share of design wins has converted into shipments, and how much content value is specifically attributable to on-device inference?"),
}

LAYERS = {key:(g["name"],g["members"],g["controls"],g["label"]) for key,g in MAP.items()}
SYMBOLS = list(dict.fromkeys(["SPY"] + [s for g in MAP.values() for s in g["members"] + g["controls"]]))
