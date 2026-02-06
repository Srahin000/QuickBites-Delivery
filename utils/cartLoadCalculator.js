/**
 * Calculate the total load capacity score for a cart order
 * Based on Load Unit (LU) system for delivery capacity management
 * 
 * @param {Array} cartItems - Array of cart items with load_unit and quantity
 * @returns {Object} { totalScore, isOverloaded, foodLoad, drinkLoad, drinkCount, internalDrinks }
 */
export function calculateCartLoad(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return {
      totalScore: 0,
      isOverloaded: false,
      foodLoad: 0,
      drinkLoad: 0,
      drinkCount: 0,
      internalDrinks: 0
    };
  }

  const MAX_CAPACITY = 20.0;
  const FREE_DRINK_SLOTS = 4; // First 4 drinks fit in external pockets
  const INTERNAL_DRINK_LOAD = 4.0; // Load per drink beyond the 4 free slots

  let foodLoad = 0;
  let drinkCount = 0;

  // Drink detection keywords
  const drinkKeywords = ['soda', 'shake', 'water', 'drink', 'juice', 'tea', 'coffee', 'smoothie', 'lemonade', 'cola', 'pepsi', 'sprite'];

  cartItems.forEach(item => {
    const itemName = (item.name || '').toLowerCase();
    const quantity = item.quantity || 1;
    const loadUnit = parseFloat(item.load_unit || 0);

    // Check if item is a drink
    const isDrink = drinkKeywords.some(keyword => itemName.includes(keyword));

    if (isDrink) {
      drinkCount += quantity;
    } else {
      // It's food - accumulate load units
      foodLoad += loadUnit * quantity;
    }
  });

  // Calculate drink load
  // First 4 drinks are free (external pockets)
  // Any beyond that require internal space at 4.0 LU each
  const internalDrinks = Math.max(0, drinkCount - FREE_DRINK_SLOTS);
  const drinkLoad = internalDrinks * INTERNAL_DRINK_LOAD;

  const totalScore = foodLoad + drinkLoad;
  const isOverloaded = totalScore > MAX_CAPACITY;

  return {
    totalScore: parseFloat(totalScore.toFixed(2)),
    isOverloaded,
    foodLoad: parseFloat(foodLoad.toFixed(2)),
    drinkLoad: parseFloat(drinkLoad.toFixed(2)),
    drinkCount,
    internalDrinks
  };
}

/**
 * Get a human-readable warning message based on load score
 * @param {number} totalScore - The calculated load score
 * @param {number} maxCapacity - The slot's maximum capacity (default 20.0)
 * @returns {Object} { level, message, color, icon, bgColor }
 */
export function getLoadWarning(totalScore, maxCapacity = 20.0) {
  // No warning if within 75% of capacity
  if (totalScore <= maxCapacity * 0.75) {
    return {
      level: 'normal',
      message: null,
      color: null,
      icon: null,
      bgColor: null
    };
  }

  // Warning if between 75% and 100% of capacity
  if (totalScore <= maxCapacity) {
    return {
      level: 'large',
      message: 'Large Order: Handled with extra care',
      color: '#F59E0B', // Amber/Yellow
      icon: 'alert-circle',
      bgColor: '#FEF3C7'
    };
  }

  // Over capacity - requires split delivery
  return {
    level: 'heavy',
    message: 'Multi-Trip Order: Items will arrive in split deliveries',
    color: '#DC2626', // Red
    icon: 'alert-triangle',
    bgColor: '#FEE2E2'
  };
}
