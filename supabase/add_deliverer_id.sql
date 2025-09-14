-- Add deliverer_id column to order_status table
-- Run this in your Supabase SQL Editor

-- 1. Add deliverer_id column to order_status table
ALTER TABLE order_status 
ADD COLUMN IF NOT EXISTS deliverer_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Add index for better performance
CREATE INDEX IF NOT EXISTS idx_order_status_deliverer_id ON order_status(deliverer_id);

-- 3. Update RLS policy to allow deliverers to see their orders
CREATE POLICY "Deliverers can view their assigned orders" ON order_status
  FOR SELECT USING (
    deliverer_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_status.order_id 
      AND orders.user_id = auth.uid()
    )
  );

-- 4. Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'order_status' 
AND column_name = 'deliverer_id';
