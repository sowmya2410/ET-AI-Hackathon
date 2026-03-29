# GCN D2C Fintech Edition

## Autonomous Content Generation System for Consumer Fintech

---

## Overview

GCN D2C Fintech Edition is a multi-agent AI system designed to automate the generation, validation, compliance checking, and optimization of consumer-facing fintech content.

The system addresses a key challenge in D2C fintech: generating high-quality, persona-specific, and regulation-compliant content across diverse user segments, while reducing turnaround time from days to hours.

This implementation includes:

* A full multi-agent orchestration pipeline
* A simulated fintech product company interface (Stackr Financial)
* Structured product specification ingestion
* PDF-based input extension for enterprise workflows
* Analytics-driven strategy optimization

---

## Problem Statement

D2C fintech platforms must generate content for three distinct user segments:

* **Gen Z (18–25)**
  Short, informal, high-engagement content
  Platforms: Instagram, WhatsApp, Shorts

* **Millennials (26–38)**
  Structured, detailed, trust-oriented content
  Platforms: Blogs, Email, LinkedIn

* **Bharat (Tier 2/3, vernacular)**
  Regional language, low-complexity explanations
  Platforms: WhatsApp, voice-first formats

All content must comply with strict regulatory constraints:

* RBI Fair Practices Code
* TRAI DLT requirements
* DPDPA 2023
* No misleading or guaranteed-return claims

Traditional workflows require multiple manual approvals over several days.
This system reduces the process to an automated pipeline executed within hours.

---

## System Components

### 1. `index.html` — Main Orchestrator UI

This is the primary interface to run the system.

Features:

* Command input for campaign generation
* Pipeline execution trigger
* Displays outputs from all agents
* Shows simulated content across channels
* Displays analytics (impressions, CTR)
* Integrates audit logs and strategy outputs

---

### 2. `stackr.html` — Product Intelligence Layer

Simulates a real fintech company:

**Stackr Financial — India’s Consumer-First Financial Stack**

Includes three products:

* **InstaCash**
  Personal loans (₹10K–₹5L)
  Target: Millennials
  Compliance: RBI Fair Practices, TRAI DLT
  Persona: Planner / Hustler

* **PayFlow**
  UPI cashback system
  Target: Gen Z + Millennials
  Compliance: NPCI, TRAI DLT
  Persona: Hustler

* **VaultSave**
  Vernacular micro-savings wallet
  Target: Bharat Tier 2/3
  Compliance: SEBI, DPDPA
  Persona: Neighbour

---

### Product Modal Features

On selecting a product:

* Displays financial parameters
* Shows compliance constraints
* Lists prohibited language
* Defines channel mix
* Provides a structured content brief

---

### Download Feature

* Generates `.txt` file containing:

  * Full product specification
  * Pre-structured GCN input prompt
* Directly usable by Agent 1

---

## Input System

The system now supports **three input sources**:

---

### 1. Manual Prompt Input (UI)

User enters campaign instructions directly in `index.html`.

---

### 2. Product Specification (Stackr UI)

Structured product data is injected into the pipeline:

* Product details
* Compliance rules
* Persona mapping
* Channel instructions

---

### 3. PDF Upload (Enterprise Extension)

A PDF upload option allows:

* Uploading product specification documents
* Extracting relevant content
* Feeding structured data into Agent 1

This enables enterprise workflows where product data is stored in documents.

---

## Agent Pipeline

Agent Flow:

Agent 1 → Input Processing (Prompt + Product Spec + PDF)
Agent 2 → Persona Selection
Agent 3 → Content Generation
Agent 4–7 → Validation + Formatting
Agent 8 → Publishing Simulation
Agent 9 → Analytics + Reporting

Additional Layers:

* Persona Validation (LLM-based)
* Strategy Analyzer (pattern detection)
* Audit Logging (Firebase + downloadable reports)

---

## Key Enhancements

### Structured Input Processing (Agent 1)

* Accepts multi-source input:

  * UI prompt
  * Product specification
  * Extracted PDF content
* Combines into a unified content brief

---

### Hybrid Content Generation

* Rule-based + LLM-based formatting (Agent 7)
* Persona-driven generation
* Compliance-aware output

---

### Strategy Intelligence Layer

* Stores analytics across runs
* Detects performance patterns
* Suggests content mix changes
* Generates improved content calendar (Claude)

---

### Audit Logging

* Tracks agent-level decisions
* Stores logs in Firebase
* Supports report download

---

## Project Structure

```text
agents/
  agent1.js
  agent2.js
  agent3.js
  agent4.js
  agent5.js
  agent6.js
  agent7.js
  agent8.js
  agent9.js
  strategyCrewAgent.js
  personaValidator.js
  agentA.js

data/
  analyticsMemory.js
  ruleDb.js
  vectorDb.js

utils/
  logger.js
  scoring.js
  firebase.js

index.html
stackr.html
styles/
```

---

## Setup Instructions

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/gcn-d2c-fintech.git
cd gcn-d2c-fintech
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Configure Environment Variables

Create `.env`:

```env
GROQ_API_KEY=your_key
```

---

### 4. Firebase Setup

1. Create project
2. Enable Firestore
3. Update:

```text
utils/firebase.js
```

4. Set rules (for demo):

```text
allow read, write: if true;
```

---

### 5. Run Application

```bash
python3 -m http.server 5501
```

Open:

```text
http://localhost:5501
```

---

## How the System Works

1. User selects product or enters prompt
2. Optional PDF is uploaded for additional context
3. Agent 1 combines all inputs into structured brief
4. Content is generated and validated
5. UI simulates publishing
6. Analytics are generated
7. Strategy analyzer updates content strategy
8. Calendar is generated using LLM

---

## Future Scope

* Advanced PDF parsing with structured extraction
* Real-time analytics dashboard
* Reinforcement learning for content optimization
* Multi-language content generation
* CrewAI-based orchestration layer

---

## Author

Siva Sowmya
Rasigapriya
Shevaniga
