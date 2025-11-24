#!/usr/bin/env node
/**
 * Test script to verify password field is not exposed in API responses
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sammo';

async function testPasswordSecurity() {
  console.log('🔐 Testing Password Field Security\n');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Dynamically import User model
    const { User } = await import('./src/models/user.model.js');
    
    // Test 1: Schema should have select: false on password
    console.log('Test 1: Checking schema configuration...');
    const passwordField = User.schema.path('password');
    if (passwordField && passwordField.options.select === false) {
      console.log('✅ Password field has select: false in schema\n');
    } else {
      console.log('❌ Password field does NOT have select: false in schema\n');
    }
    
    // Test 2: Create a test user
    console.log('Test 2: Creating test user...');
    const testUsername = `test_password_security_${Date.now()}`;
    const testUser = await User.create({
      username: testUsername,
      password: 'test_password_hash',
      name: 'Test User',
      grade: 1
    });
    console.log(`✅ Created test user: ${testUser._id}\n`);
    
    // Test 3: findById without select should not return password
    console.log('Test 3: Testing findById() without explicit select...');
    const user1 = await User.findById(testUser._id);
    if (user1) {
      if (user1.password === undefined) {
        console.log('✅ Password NOT returned by findById()\n');
      } else {
        console.log('❌ Password RETURNED by findById():', user1.password, '\n');
      }
    }
    
    // Test 4: findById with -password should not return password
    console.log('Test 4: Testing findById().select("-password")...');
    const user2 = await User.findById(testUser._id).select('-password');
    if (user2) {
      if (user2.password === undefined) {
        console.log('✅ Password NOT returned by findById().select("-password")\n');
      } else {
        console.log('❌ Password RETURNED by findById().select("-password"):', user2.password, '\n');
      }
    }
    
    // Test 5: findOne should not return password
    console.log('Test 5: Testing findOne()...');
    const user3 = await User.findOne({ username: testUsername });
    if (user3) {
      if (user3.password === undefined) {
        console.log('✅ Password NOT returned by findOne()\n');
      } else {
        console.log('❌ Password RETURNED by findOne():', user3.password, '\n');
      }
    }
    
    // Test 6: find should not return password
    console.log('Test 6: Testing find()...');
    const users = await User.find({ username: testUsername });
    if (users.length > 0) {
      if (users[0].password === undefined) {
        console.log('✅ Password NOT returned by find()\n');
      } else {
        console.log('❌ Password RETURNED by find():', users[0].password, '\n');
      }
    }
    
    // Test 7: Explicitly requesting password with +password should work
    console.log('Test 7: Testing findOne().select("+password") for login...');
    const user4 = await User.findOne({ username: testUsername }).select('+password');
    if (user4) {
      if (user4.password !== undefined && user4.password === 'test_password_hash') {
        console.log('✅ Password RETURNED when explicitly requested with +password\n');
      } else {
        console.log('❌ Password NOT returned even with +password:', user4.password, '\n');
      }
    }
    
    // Test 8: toJSON should not include password
    console.log('Test 8: Testing toJSON()...');
    const user5 = await User.findOne({ username: testUsername }).select('+password');
    if (user5) {
      const jsonUser = user5.toJSON();
      if (jsonUser.password === undefined) {
        console.log('✅ Password NOT included in toJSON()\n');
      } else {
        console.log('❌ Password INCLUDED in toJSON():', jsonUser.password, '\n');
      }
    }
    
    // Cleanup
    console.log('Cleaning up test user...');
    await User.deleteOne({ _id: testUser._id });
    console.log('✅ Test user deleted\n');
    
    console.log('✅ All password security tests completed!');
    
  } catch (error) {
    console.error('❌ Error during tests:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

testPasswordSecurity();
