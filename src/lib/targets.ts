// Calorie/macro target calculation: Mifflin-St Jeor BMR × activity × goal delta.
// Server-enforced calorie floor is a safety feature (see docs/07-moderation.md §4).

export const CALORIE_FLOOR = 1200;

const ACTIVITY: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

const GOAL_DELTA: Record<string, number> = {
  fat_loss: -0.2,
  muscle_gain: 0.1,
  maintenance: 0,
  recomp: 0,
  performance: 0.05,
  general_health: 0,
  custom: 0,
};

// g protein per kg bodyweight by goal
const PROTEIN_PER_KG: Record<string, number> = {
  fat_loss: 2.0,
  muscle_gain: 1.8,
  maintenance: 1.6,
  recomp: 2.0,
  performance: 1.8,
  general_health: 1.4,
  custom: 1.6,
};

export type TargetInput = {
  sex: "male" | "female";
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: string;
  goal: string;
};

export function calculateTargets(input: TargetInput) {
  const { sex, weightKg, heightCm, age, activityLevel, goal } = input;
  const bmr =
    10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
  const tdee = bmr * (ACTIVITY[activityLevel] ?? 1.4);
  const calories = Math.max(
    CALORIE_FLOOR,
    Math.round((tdee * (1 + (GOAL_DELTA[goal] ?? 0))) / 10) * 10,
  );
  const proteinG = Math.round(weightKg * (PROTEIN_PER_KG[goal] ?? 1.6));
  const fatG = Math.round((calories * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  return { calories, proteinG, carbsG, fatG };
}
