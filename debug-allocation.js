// Debug why allocation is failing
const MIN_ALLOC = 15;

const weights = new Map([
  ['project-1', 705.226530],
  ['project-2', 705.051112]
]);

const budget = 30;
const totalWeight = 1410.277642;

console.log('=== ALLOCATION DEBUG ===');
console.log(`Budget: ${budget} minutes`);
console.log(`Total weight: ${totalWeight.toFixed(6)}`);
console.log(`Minimum allocation: ${MIN_ALLOC} minutes`);
console.log('');

weights.forEach((weight, projectId) => {
  const allocation = Math.round((weight / totalWeight) * budget);
  console.log(`${projectId}:`);
  console.log(`  Weight: ${weight.toFixed(6)}`);
  console.log(`  Weight ratio: ${(weight / totalWeight).toFixed(6)}`);
  console.log(`  Raw allocation: ${(weight / totalWeight) * budget}`);
  console.log(`  Rounded allocation: ${allocation}`);
  console.log(`  Meets minimum: ${allocation >= MIN_ALLOC}`);
  console.log('');
});

// The issue is that with equal weights, each gets ~15 minutes
// But if the rounding gives 14 or 15, one might not meet MIN_ALLOC
console.log('=== SOLUTION ===');
console.log('Both projects should get exactly 15 minutes each since they have equal weights');
console.log('The issue might be in the rounding logic or minimum allocation check');
