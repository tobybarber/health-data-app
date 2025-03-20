/**
 * Returns a detailed description for a given diet type
 * @param dietType The diet type value 
 * @returns Detailed description of the diet type
 */
export function getDietTypeDescription(dietType: string): string {
  switch (dietType) {
    case 'whole-foods':
      return 'Mostly whole foods (fruits, vegetables, lean meats, whole grains) - nutrient-rich, balanced diet';
    case 'mixed':
      return 'Balanced mix of whole foods and some processed foods - moderate diet with room for improvement';
    case 'processed':
      return 'Mostly processed foods (fast food, sugary drinks, packaged snacks) - high in calories, sodium, and fats';
    case 'irregular':
      return 'Irregular eating (skipping meals, heavy snacking, little variety) - inconsistent nutrition with poor diversity';
    case 'vegetarian':
      return 'Vegetarian diet - excludes meat, may include dairy and eggs, high in plant nutrients';
    case 'vegan':
      return 'Vegan diet - excludes all animal products, focused entirely on plant-based nutrition';
    case 'keto':
      return 'Ketogenic diet - very low carbohydrate, high fat, moderate protein diet';
    case 'paleo':
      return 'Paleolithic diet - focuses on whole foods, avoids processed foods, grains, legumes, and dairy';
    default:
      return dietType || 'Not specified';
  }
} 