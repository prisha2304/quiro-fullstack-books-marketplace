/**
 * Formats a numeric value into Indian Rupees (₹)
 * Example: 1299 -> ₹1,299
 *          15000 -> ₹15,000
 */
export const formatCurrency = (value) => {
  const number = parseFloat(value);
  if (isNaN(number)) return '₹0';
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(number);
};
