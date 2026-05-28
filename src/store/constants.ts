// ─── Static Health Knowledge Base ──────────────────────────────────────────

export const HEALTH_RESPONSES = [
  {
    keywords: ['headache', 'symptom', 'pain', 'explain symptoms'],
    response: `### Symptom Analysis: Headache Overview

Based on your symptoms, here is a diagnostic breakdown of common headache types.

| Headache Type | Location | Common Triggers | Relief Options |
| :--- | :--- | :--- | :--- |
| **Tension Headache** | Band around forehead | Stress, fatigue, eye strain | Rest, hydration, light massage |
| **Dehydration Headache** | All-over, dull throb | Lack of fluids, alcohol | Drink electrolytes, cool compress |
| **Migraine** | One-sided, pulsing | Bright lights, strong smells, food sensitivity | Dark room, medication, rest |

[HealthCardsGrid: Blood Pressure=120/80=healthy | Temperature=98.6 °F=healthy | Hydration=Low=warning]

#### Key Recommendations:
1. **Hydration First:** Drink a full 16oz glass of water immediately.
2. **Screen Rest:** Step away from screens for at least 15 minutes.
3. **Gentle Stretch:** Roll your neck and shoulders to release tension.

> [!WARNING]
> If you experience a sudden "thunderclap" headache, stiff neck, fever, or confusion, seek immediate medical attention. This information is for educational purposes only.

[FollowUps: Explain dehydration headaches? | When to see a doctor? | Suggest hydration tips]`,
  },
  {
    keywords: ['meal', 'healthy meal', 'diet', 'nutrition', 'eat', 'calories', 'weight loss', 'lose weight', 'diabetes nutrition'],
    response: `### Nutritious Meal Plan Recommendation

Here is a balanced, health-focused meal plan designed to keep your energy levels steady throughout the day:

*   **Breakfast: Avocado & Spinach Egg Toast**
    *   2 poached eggs, 1/2 avocado smashed on whole-grain sourdough toast.
*   **Lunch: Quinoa Mediterranean Salad**
    *   Fluffy quinoa, mixed greens, cherry tomatoes, cucumbers, grilled chicken breast or chickpeas, topped with feta cheese and olive oil lemon dressing.
*   **Dinner: Baked Salmon with Roasted Broccoli & Sweet Potatoes**
    *   6oz wild-caught salmon fillet alongside roasted sweet potato wedges and broccoli florets.

[HealthCardsGrid: Protein=95g=healthy | Carbohydrates=130g=healthy | Healthy Fats=65g=healthy | Est. Calories=1500 kcal=healthy]

#### Adjustments:
Would you like me to adjust this plan based on dietary restrictions (e.g., vegetarian, gluten-free) or target calories?

[FollowUps: Adjust plan for vegetarian? | Give calorie count of sweet potatoes? | Suggest fiber recipes]`,
  },
  {
    keywords: ['report', 'analyze', 'blood', 'lab', 'analyze my health report', 'analyze my blood report'],
    response: `### Health Report Analysis Summary
    
I have scanned your health report metrics. Below is the parsed result of your diagnostic markers compared to standard clinical reference ranges:

*   **Hemoglobin:** 14.2 g/dL (within standard range).
*   **Glucose:** 92 mg/dL (optimal fasting levels).
*   **Cholesterol:** 215 mg/dL (requires mild dietary adjustments).
*   **Vitamin D:** 22 ng/mL (deficient levels detected).

[HealthCardsGrid: Hemoglobin=14.2 g/dL=healthy | Fasting Glucose=92 mg/dL=healthy | Total Cholesterol=215 mg/dL=warning | Vitamin D (25-OH)=22 ng/mL=deficient]

#### Recommendations:
1. **Vitamin D Supplementation:** Your Vitamin D levels are deficient. Discuss daily Vitamin D3 (2000-5000 IU) supplementation with your doctor.
2. **Heart Healthy Fats:** To address borderline high cholesterol, increase intake of soluble fiber (oats, avocados, beans) and omega-3 fatty acids.

> [!NOTE]
> Please consult your primary care doctor to discuss these results and get a formal medical diagnosis.

[FollowUps: Explain Vitamin D deficiency? | How to lower Cholesterol? | Suggest exercise tips]`,
  },
  {
    keywords: ['calories', 'track', 'track calories'],
    response: `### Calories & Nutrition Tracking Guidelines
    
To track calories effectively and support your metabolism, follow this baseline structured approach:

1. **Calculate TDEE (Total Daily Energy Expenditure):**
   * Determine your maintenance calories using weight, height, age, and activity level.
2. **Establish Goals:**
   * **For fat loss:** Set a modest caloric deficit (10-20% below maintenance).
   * **For muscle gain:** Set a modest caloric surplus (10-15% above maintenance).

[HealthCardsGrid: TDEE Target=2200 kcal=healthy | Protein Target=140g=healthy | Deficit Target=1800 kcal=healthy]

Let me know your height, weight, and goals if you'd like me to calculate your custom calorie targets.

[FollowUps: Calculate my custom TDEE? | Best lean protein foods? | Suggest high-fiber breakfast]`,
  },
];

export const DEFAULT_RESPONSE = `### How can YHealth AI help you?

I am your dedicated **YHealth AI Assistant**. I can help you understand symptoms, analyze lab report markers, suggest balanced meal plans, or calculate nutrition goals.

Feel free to ask me questions like:
*   *"Analyze my blood report"*
*   *"Provide weight loss guidance"*
*   *"Give me diabetes nutrition tips"*
*   *"Explain tension headache symptoms"*

What would you like to explore today?

[FollowUps: Analyze my blood report | Weight loss guidance | Diabetes nutrition | Explain symptoms]`;

// ─── Restored Chat Demo Data (Existing Patient) ────────────────────────────

export const RESTORED_SESSIONS = [
  { id: 'chat_restored_1', title: 'Blood Report Analysis', timestamp: 'May 24' },
  { id: 'chat_restored_2', title: 'Headache Symptom Check', timestamp: 'May 20' },
  { id: 'chat_restored_3', title: 'Weight Loss Plan', timestamp: 'May 15' },
];

export const RESTORED_MESSAGES = {
  chat_restored_1: [
    { id: 'm1_1', sender: 'user' as const, content: 'Analyze my blood report', timestamp: '10:15 AM' },
    {
      id: 'm1_2',
      sender: 'assistant' as const,
      content: `### Health Report Analysis Summary
    
I have scanned your health report metrics. Below is the parsed result of your diagnostic markers compared to standard clinical reference ranges:

*   **Hemoglobin:** 14.2 g/dL (within standard range).
*   **Glucose:** 92 mg/dL (optimal fasting levels).
*   **Cholesterol:** 215 mg/dL (requires mild dietary adjustments).
*   **Vitamin D:** 22 ng/mL (deficient levels detected).

[HealthCardsGrid: Hemoglobin=14.2 g/dL=healthy | Fasting Glucose=92 mg/dL=healthy | Total Cholesterol=215 mg/dL=warning | Vitamin D (25-OH)=22 ng/mL=deficient]

#### Recommendations:
1. **Vitamin D Supplementation:** Your Vitamin D levels are deficient. Discuss daily Vitamin D3 (2000-5000 IU) supplementation with your doctor.
2. **Heart Healthy Fats:** To address borderline high cholesterol, increase intake of soluble fiber (oats, avocados, beans) and omega-3 fatty acids.

[FollowUps: Explain Vitamin D deficiency? | How to lower Cholesterol? | Suggest exercise tips]`,
      timestamp: '10:16 AM',
    },
  ],
  chat_restored_2: [
    { id: 'm2_1', sender: 'user' as const, content: 'Explain my symptoms, I have forehead headaches', timestamp: '04:30 PM' },
    {
      id: 'm2_2',
      sender: 'assistant' as const,
      content: `### Symptom Analysis: Headache Overview

Based on your symptoms, here is a diagnostic breakdown of common headache types.

| Headache Type | Location | Common Triggers | Relief Options |
| :--- | :--- | :--- | :--- |
| **Tension Headache** | Band around forehead | Stress, fatigue, eye strain | Rest, hydration, light massage |
| **Dehydration Headache** | All-over, dull throb | Lack of fluids, alcohol | Drink electrolytes, cool compress |

[HealthCardsGrid: Blood Pressure=120/80=healthy | Temperature=98.6 °F=healthy | Hydration=Low=warning]

[FollowUps: Suggest hydration tips | When to see a doctor?]`,
      timestamp: '04:31 PM',
    },
  ],
  chat_restored_3: [
    { id: 'm3_1', sender: 'user' as const, content: 'Suggest healthy meal plans to lose weight', timestamp: '11:00 AM' },
    {
      id: 'm3_2',
      sender: 'assistant' as const,
      content: `### Nutritious Weight-Loss Plan

Here is your custom high-protein meal framework:

*   **Breakfast:** Egg whites scrambled with spinach and avocado toast.
*   **Lunch:** Mediterranean salad with grilled chicken and lemon vinaigrette.
*   **Dinner:** Baked wild salmon with steamed broccoli and sweet potato.

[HealthCardsGrid: Protein=95g=healthy | Carbohydrates=130g=healthy | Est. Calories=1500 kcal=healthy]`,
      timestamp: '11:01 AM',
    },
  ],
};
