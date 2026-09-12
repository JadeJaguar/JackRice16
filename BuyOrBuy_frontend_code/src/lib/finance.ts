export const DEFAULT_CATEGORIES = [
  { name: "Dining", icon: "utensils", description: "Meals, coffee, delivery, and social dining.", examples: ["Coffee", "Lunch", "Takeout"], target: 320 },
  { name: "Shopping", icon: "bag", description: "Clothing, home goods, beauty, and personal purchases.", examples: ["Shoes", "Skincare", "Decor"], target: 240 },
  { name: "Transport", icon: "car", description: "Daily travel and getting around.", examples: ["Transit", "Fuel", "Rideshare"], target: 180 },
  { name: "Wellness", icon: "heart", description: "Health, fitness, and caring for yourself.", examples: ["Gym", "Pharmacy", "Yoga"], target: 160 },
  { name: "Fun", icon: "ticket", description: "Entertainment and experiences worth planning for.", examples: ["Movies", "Concerts", "Games"], target: 140 },
  { name: "Home", icon: "home", description: "Household essentials and recurring home costs.", examples: ["Supplies", "Utilities", "Repairs"], target: 400 },
] as const;

export const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
export const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
