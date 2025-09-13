-- Debug authentication context for RLS policies
-- Run these queries while logged in as a user to see what auth.uid() returns

-- 1. Check what auth.uid() returns
SELECT 
  auth.uid() as current_auth_uid,
  auth.uid() IS NOT NULL as auth_uid_is_not_null;

-- 2. Check current user details
SELECT 
  auth.uid() as user_id,
  auth.email() as user_email,
  auth.role() as user_role;

-- 3. Try a simple test insert to see the exact error
-- First create a test table without RLS
CREATE TABLE IF NOT EXISTS test_table (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  test_data TEXT
);

-- Try inserting with auth.uid()
INSERT INTO test_table (user_id, test_data) 
VALUES (auth.uid(), 'test data');

-- Check if the insert worked
SELECT * FROM test_table WHERE user_id = auth.uid();

-- Clean up
DROP TABLE IF EXISTS test_table;