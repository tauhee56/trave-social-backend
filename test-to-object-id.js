#!/usr/bin/env node
const { ObjectId } = require('mongodb');

// Helper function to convert string to ObjectId
const toObjectId = (id) => {
  if (typeof id === 'object' && id._bsontype === 'ObjectId') return id;
  return new ObjectId(id);
};

console.log('✅ Testing toObjectId function...');

try {
  const result1 = toObjectId('507f1f77bcf86cd799439011');
  console.log('  ✅ toObjectId("507f1f77bcf86cd799439011") =', result1.toString());
  
  const result2 = toObjectId(result1);
  console.log('  ✅ toObjectId(ObjectId) =', result2.toString());
  
  console.log('\n✅ All tests passed!');
} catch (err) {
  console.error('❌ Error:', err.message);
}
